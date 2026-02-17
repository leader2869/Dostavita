-- Миграция 089: Обработка оплаты через триггеры
-- Проблема: функции с SECURITY DEFINER не могут обойти RLS для INSERT/UPDATE
-- Решение: используем триггеры для автоматического создания транзакций и обновления баланса

-- Удаляем старые функции
DROP FUNCTION IF EXISTS public.create_transaction(UUID, UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_or_update_balance(UUID, DECIMAL);
DROP FUNCTION IF EXISTS public.process_order_payment(UUID, BOOLEAN);

-- Удаляем старые триггеры, если они существуют
DROP TRIGGER IF EXISTS on_order_payment_processed ON public.orders;

-- Функция-триггер для обработки оплаты заказа
CREATE OR REPLACE FUNCTION public.handle_order_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_balance DECIMAL(10, 2);
  transaction_id UUID;
  rows_inserted INTEGER;
BEGIN
  -- Логируем все изменения is_paid для отладки
  RAISE NOTICE 'Триггер handle_order_payment: OLD.is_paid = %, NEW.is_paid = %, NEW.status = %, NEW.executor_user_id = %', 
    OLD.is_paid, NEW.is_paid, NEW.status, NEW.executor_user_id;
  
  -- Триггер срабатывает только когда is_paid меняется с false/null на true
  -- И заказ завершен или доставляется
  -- Убираем проверку статуса, так как оплата может обрабатываться в любом статусе
  IF NEW.is_paid = true 
     AND (OLD.is_paid IS NULL OR OLD.is_paid = false)
     AND NEW.executor_user_id IS NOT NULL THEN
    
    RAISE NOTICE 'Условия триггера выполнены: is_paid = true, executor_user_id = %, status = %', 
      NEW.executor_user_id, NEW.status;
    
    RAISE NOTICE 'Триггер сработал для заказа %: is_paid изменился на true', NEW.id;
    
    -- Создаем транзакцию (триггеры автоматически обходят RLS)
    INSERT INTO public.transactions (user_id, order_id, amount, type, description, created_at)
    VALUES (
      NEW.executor_user_id,
      NEW.id,
      NEW.final_price,
      'credit',
      'Начисление за выполнение Заказа №' || NEW.order_number::TEXT,
      COALESCE(NEW.completed_at, NOW())
    )
    RETURNING id INTO transaction_id;
    
    -- Проверяем, что транзакция создана
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    IF rows_inserted = 0 THEN
      RAISE EXCEPTION 'Не удалось создать транзакцию для заказа %', NEW.id;
    END IF;
    
    RAISE NOTICE 'Транзакция создана: %', transaction_id;
    
    -- Рассчитываем баланс как сумму всех транзакций типа 'credit'
    SELECT COALESCE(SUM(amount), 0) INTO calculated_balance
    FROM public.transactions
    WHERE user_id = NEW.executor_user_id
      AND type = 'credit';
    
    RAISE NOTICE 'Рассчитанный баланс: %', calculated_balance;
    
    -- Создаем или обновляем баланс
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (NEW.executor_user_id, calculated_balance, 'BYN', NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET 
      amount = calculated_balance,
      updated_at = NOW();
    
    RAISE NOTICE 'Баланс обновлен для пользователя %: %', NEW.executor_user_id, calculated_balance;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- В случае ошибки логируем и возвращаем NEW, чтобы не блокировать обновление заказа
    RAISE WARNING 'Ошибка при обработке оплаты заказа %: %', NEW.id, SQLERRM;
    RAISE WARNING 'Детали ошибки: %', SQLSTATE;
    RETURN NEW;
END;
$$;

-- Создаем триггер
-- Убираем условие WHEN из триггера, проверку делаем внутри функции
-- Это гарантирует, что триггер сработает при любом изменении is_paid
CREATE TRIGGER on_order_payment_processed
  AFTER UPDATE OF is_paid ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_payment();

-- Упрощенная функция process_order_payment (только обновляет is_paid, триггер сделает остальное)
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
  debtor_user_id UUID;
BEGIN
  -- Получаем заказ (можно обрабатывать оплату только для заказов в статусе "доставляет" или "завершен")
  SELECT * INTO order_record
  FROM public.orders o
  WHERE o.id = order_uuid 
    AND (o.status = 'courier_delivering' OR o.status = 'completed')
    AND o.executor_user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE WARNING 'Заказ не найден или не принадлежит текущему водителю: %', order_uuid;
    RETURN FALSE;
  END IF;
  
  -- Проверяем, что оплата еще не обработана
  IF order_record.is_paid IS NOT NULL AND order_record.is_paid = true THEN
    RAISE WARNING 'Оплата для заказа % уже обработана (is_paid = true)', order_uuid;
    RETURN FALSE;
  END IF;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем статус оплаты заказа
  -- Триггер автоматически создаст транзакцию и обновит баланс
  UPDATE public.orders
  SET 
    is_paid = payment_status
  WHERE orders.id = order_uuid;
  
  IF payment_status THEN
    -- Если оплата получена, триггер создаст транзакцию и обновит баланс
    -- Ничего дополнительного делать не нужно
  ELSE
    -- Если оплата не получена, создаем запись о дебиторке
    IF order_record.paid_by = 'sender' THEN
      debtor_user_id := order_record.client_id;
    ELSE
      debtor_user_id := NULL;
    END IF;
    
    INSERT INTO public.receivables (
      order_id,
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
      order_record.paid_by,
      debtor_user_id,
      order_record.final_price,
      'BYN',
      'unpaid',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.process_order_payment(UUID, BOOLEAN) IS 'Обрабатывает оплату заказа. Обновляет is_paid, триггер автоматически создает транзакцию и обновляет баланс. Баланс = сумма всех транзакций типа credit (оплаченные заказы).';

COMMENT ON FUNCTION public.handle_order_payment() IS 'Триггер для автоматического создания транзакций и обновления баланса при оплате заказа. Обходит RLS автоматически.';

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;

