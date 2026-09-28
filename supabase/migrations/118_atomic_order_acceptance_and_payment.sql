-- 118: Атомарное принятие заказа и идемпотентная оплата.
-- Исторические транзакции не удаляются и не пересчитываются.
BEGIN;

CREATE OR REPLACE FUNCTION public.accept_order(order_uuid UUID, driver_user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR driver_user_uuid IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver'
      AND vehicle_type IS NOT NULL AND license_number IS NOT NULL
  ) THEN
    RETURN FALSE;
  END IF;

  -- PostgreSQL повторно проверяет WHERE после ожидания блокировки строки.
  UPDATE public.orders
  SET executor_user_id = driver_user_uuid, status = 'courier_accepted', accepted_at = NOW()
  WHERE id = order_uuid AND status = 'searching_courier' AND executor_user_id IS NULL;
  RETURN FOUND;
END;
$$;

-- Сохраняем поддержку старых прямых обновлений is_paid, но убираем
-- проверку по времени и подавление ошибок старого триггера.
CREATE OR REPLACE FUNCTION public.handle_order_payment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  calculated_balance NUMERIC(10,2);
BEGIN
  IF NEW.is_paid IS TRUE AND OLD.is_paid IS DISTINCT FROM TRUE
     AND NEW.executor_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.transactions WHERE order_id = NEW.id AND type = 'credit') THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.balances(user_id,amount,currency,updated_at)
    VALUES (NEW.executor_user_id,0,'BYN',NOW()) ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM public.balances WHERE user_id = NEW.executor_user_id FOR UPDATE;
    INSERT INTO public.transactions(user_id,order_id,amount,type,description,created_at,related_user_id)
    VALUES (NEW.executor_user_id,NEW.id,NEW.final_price,'credit',
      'Начисление за оплату Заказа №' || NEW.order_number::TEXT,
      COALESCE(NEW.completed_at,NOW()),NEW.executor_user_id);
    SELECT public.calculate_driver_balance(NEW.executor_user_id) INTO calculated_balance;
    UPDATE public.balances SET amount=calculated_balance,updated_at=NOW()
    WHERE user_id=NEW.executor_user_id;
    DELETE FROM public.receivables WHERE order_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_payment_processed ON public.orders;
CREATE TRIGGER on_order_payment_processed AFTER UPDATE OF is_paid ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_payment();

CREATE OR REPLACE FUNCTION public.prevent_paid_order_reset()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF OLD.is_paid IS TRUE AND NEW.is_paid IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Оплаченный заказ нельзя пометить неоплаченным';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_paid_order_reset ON public.orders;
CREATE TRIGGER prevent_paid_order_reset BEFORE UPDATE OF is_paid ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_order_reset();

CREATE OR REPLACE FUNCTION public.process_order_payment(
  order_uuid UUID,
  payment_status BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  driver_user_id UUID;
  driver_org_id UUID;
  debtor_user_id UUID;
  existing_receivable_id UUID;
  recipient_user_id UUID;
  calculated_balance DECIMAL(10, 2);
  transaction_id UUID;
  caller_role TEXT;
BEGIN
  -- Логируем входные параметры для отладки
  RAISE NOTICE 'process_order_payment вызвана: order_uuid = %, payment_status = %', 
    order_uuid, payment_status;
  
  -- Валидация входного параметра
  IF order_uuid IS NULL OR payment_status IS NULL THEN
    RAISE EXCEPTION 'order_uuid и payment_status обязательны';
  END IF;
  
  -- Получаем роль текущего пользователя
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Пользователь не найден в профилях';
  END IF;
  
  -- Получаем заказ (может быть в статусе courier_delivering или completed)
  SELECT * INTO order_record
  FROM public.orders o
  WHERE o.id = order_uuid
    AND (o.status = 'courier_delivering' OR o.status = 'completed')
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Заказ не найден или не в правильном статусе. Заказ должен быть в статусе "доставляет" или "завершен"';
  END IF;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RAISE EXCEPTION 'Водитель не назначен на заказ';
  END IF;
  
  -- Проверяем права доступа и определяем, кому начисляются деньги
  IF caller_role = 'driver' THEN
    IF driver_user_id != auth.uid() THEN
      RAISE EXCEPTION 'Водитель может провести оплату только для своих заказов';
    END IF;
    recipient_user_id := driver_user_id;
  ELSIF caller_role = 'customer' THEN
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    IF driver_org_id IS NULL OR driver_org_id != auth.uid() THEN
      RAISE EXCEPTION 'Организация может провести оплату только для заказов своих водителей';
    END IF;
    recipient_user_id := auth.uid();
  ELSE
    RAISE EXCEPTION 'Только водители и организации могут проводить оплату';
  END IF;
  
  -- Если payment_status = true (принимаем оплату)
  IF payment_status THEN
    -- Если заказ уже оплачен, просто удаляем receivables и возвращаем успех
    IF order_record.is_paid = true THEN
      DELETE FROM public.receivables WHERE order_id = order_uuid;
      RAISE NOTICE 'Заказ % уже оплачен. Дебиторка удалена, если существовала.', order_uuid;
      RETURN TRUE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM public.transactions WHERE order_id = order_uuid AND type = 'credit') THEN
      RAISE EXCEPTION 'У заказа уже есть начисление: требуется сверка оплаты';
    END IF;

    -- Сериализуем также оплаты разных заказов одному получателю.
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (recipient_user_id, 0, 'BYN', NOW()) ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM public.balances WHERE user_id = recipient_user_id FOR UPDATE;
    
    -- Создаем транзакцию для получателя (водителя или организации)
    INSERT INTO public.transactions (user_id, order_id, amount, type, description, created_at, related_user_id)
    VALUES (
      recipient_user_id,
      order_uuid,
      order_record.final_price,
      'credit',
      'Начисление за оплату Заказа №' || order_record.order_number::TEXT || 
        CASE 
          WHEN recipient_user_id = driver_user_id THEN ' (оплата водителем)'
          ELSE ' (оплата организацией)'
        END,
      COALESCE(order_record.completed_at, NOW()),
      driver_user_id  -- related_user_id всегда указывает на водителя, даже если оплата принята организацией
    )
    RETURNING id INTO transaction_id;
    
    -- Начисление уже существует: AFTER-триггер не должен создавать второе.
    UPDATE public.orders SET is_paid = true WHERE id = order_uuid;

    -- Рассчитываем баланс получателя
    IF recipient_user_id = driver_user_id THEN
      -- Для водителя: все credit - только debit от сдачи кассы
      SELECT public.calculate_driver_balance(recipient_user_id) INTO calculated_balance;
    ELSE
      -- Для организации: все credit - все debit
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
      INTO calculated_balance
      FROM public.transactions
      WHERE user_id = recipient_user_id;
    END IF;
    
    -- Обновляем баланс получателя
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (recipient_user_id, calculated_balance, 'BYN', NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET 
      amount = calculated_balance,
      updated_at = NOW();
    
    RAISE NOTICE 'Транзакция создана для пользователя %: %, баланс обновлен: %', 
      recipient_user_id, transaction_id, calculated_balance;
    
    -- Удаляем запись из receivables
    DELETE FROM public.receivables WHERE order_id = order_uuid;
    
    RAISE NOTICE 'Дебиторка для заказа % удалена после оплаты', order_uuid;
    
  ELSE
    IF order_record.is_paid IS TRUE THEN
      RAISE EXCEPTION 'Оплаченный заказ нельзя пометить неоплаченным';
    END IF;
    -- Если payment_status = false (заказ не оплачен)
    -- Проверяем, существует ли уже receivables
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;
    
    IF existing_receivable_id IS NOT NULL THEN
      RAISE NOTICE 'Дебиторка для заказа % уже существует (id: %). Пропускаем создание.', order_uuid, existing_receivable_id;
      RETURN TRUE;
    END IF;
    
    -- Обновляем статус оплаты заказа
    UPDATE public.orders
    SET is_paid = false
    WHERE orders.id = order_uuid;
    
    -- Определяем должника
    IF order_record.paid_by = 'sender' THEN
      debtor_user_id := order_record.client_id;
    ELSE
      debtor_user_id := NULL;
    END IF;
    
    -- Получаем organization_id водителя
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    
    -- Создаем запись в receivables
    INSERT INTO public.receivables (
      order_id,
      driver_user_id,
      organization_id,
      debtor_type,
      debtor_user_id,
      amount,
      currency,
      status,
      created_at,
      updated_at
    )
    VALUES (
      order_uuid,
      driver_user_id,
      driver_org_id,
      COALESCE(order_record.paid_by, 'sender'),
      debtor_user_id,
      order_record.final_price,
      'BYN',
      'unpaid',
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO NOTHING; -- Защита от дубликатов
    
    RAISE NOTICE 'Создана дебиторка для заказа %', order_uuid;
  END IF;
  
  RETURN TRUE;
END;
$$;


REVOKE ALL ON FUNCTION public.accept_order(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.process_order_payment(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;
COMMIT;
