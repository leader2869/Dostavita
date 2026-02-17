-- Миграция 101: Исправление логики расчета баланса водителя
-- Баланс = все принятые деньги (credit) - только деньги, сданные организации (debit при сдаче кассы)

-- Создаем функцию для расчета баланса водителя
CREATE OR REPLACE FUNCTION public.calculate_driver_balance(driver_user_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_balance DECIMAL(10, 2);
BEGIN
  -- Баланс = все credit транзакции - только те debit транзакции, которые связаны со сдачей кассы организации
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE 
      WHEN type = 'debit' AND (
        description LIKE '%Сдача кассы%' OR 
        description LIKE '%Изъятие кассы%' OR
        (related_user_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = related_user_id AND p.role = 'customer'
        ))
      ) THEN amount 
      ELSE 0 
    END), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE user_id = driver_user_id;
  
  RETURN calculated_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_driver_balance(UUID) TO authenticated;

-- Обновляем функцию approve_cash_deposit_request
DROP FUNCTION IF EXISTS public.approve_cash_deposit_request(UUID);

CREATE OR REPLACE FUNCTION public.approve_cash_deposit_request(
  request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
  driver_balance DECIMAL(10, 2);
  calculated_balance DECIMAL(10, 2);
BEGIN
  -- Получаем запрос
  SELECT * INTO request_record
  FROM public.cash_deposit_requests
  WHERE id = request_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запрос не найден или уже обработан';
  END IF;
  
  -- Проверяем, что текущий пользователь - организация запроса
  IF request_record.organization_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы не можете принять этот запрос';
  END IF;
  
  -- Проверяем баланс водителя
  SELECT COALESCE(amount, 0) INTO driver_balance
  FROM public.balances
  WHERE user_id = request_record.driver_user_id;
  
  IF driver_balance < request_record.amount THEN
    RAISE EXCEPTION 'У водителя недостаточно средств. Доступно: %', driver_balance;
  END IF;
  
  -- Создаем баланс для организации, если его нет
  INSERT INTO public.balances (user_id, amount, currency, updated_at)
  VALUES (request_record.organization_id, 0.00, 'BYN', NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 1. Списываем средства с баланса водителя (debit транзакция)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    related_user_id,
    created_at
  )
  VALUES (
    request_record.driver_user_id,
    request_record.amount,
    'debit',
    'Сдача кассы организации (запрос №' || request_record.id::TEXT || ')',
    request_record.organization_id,
    NOW()
  );
  
  -- 2. Зачисляем средства на баланс организации (credit транзакция)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    related_user_id,
    created_at
  )
  VALUES (
    request_record.organization_id,
    request_record.amount,
    'credit',
    'Получение кассы от водителя (запрос №' || request_record.id::TEXT || ')',
    request_record.driver_user_id,
    NOW()
  );
  
  -- 3. Обновляем баланс водителя (все credit - только debit от сдачи кассы)
  SELECT public.calculate_driver_balance(request_record.driver_user_id) INTO calculated_balance;
  
  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = request_record.driver_user_id;
  
  -- 4. Обновляем баланс организации (все credit - все debit)
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE user_id = request_record.organization_id;
  
  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = request_record.organization_id;
  
  -- Обновляем статус запроса
  UPDATE public.cash_deposit_requests
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = auth.uid(),
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_cash_deposit_request(UUID) TO authenticated;

-- Обновляем функцию withdraw_cash_from_driver
DROP FUNCTION IF EXISTS public.withdraw_cash_from_driver(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION public.withdraw_cash_from_driver(
  driver_user_id UUID,
  amount_to_withdraw DECIMAL(10, 2)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  organization_user_id UUID;
  driver_balance DECIMAL(10, 2);
  calculated_balance DECIMAL(10, 2);
  driver_role TEXT;
BEGIN
  -- Получаем роль текущего пользователя
  SELECT role INTO driver_role FROM public.profiles WHERE id = auth.uid();
  
  IF driver_role != 'customer' THEN
    RAISE EXCEPTION 'Только организации могут забирать кассу у водителей';
  END IF;
  
  organization_user_id := auth.uid();
  
  -- Проверяем, что водитель привязан к этой организации
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = driver_user_id
      AND role = 'driver'
      AND organization_id = organization_user_id
  ) THEN
    RAISE EXCEPTION 'Водитель не привязан к вашей организации';
  END IF;
  
  -- Получаем текущий баланс водителя
  SELECT COALESCE(amount, 0) INTO driver_balance
  FROM public.balances
  WHERE user_id = driver_user_id;
  
  -- Проверяем, что у водителя достаточно средств
  IF driver_balance < amount_to_withdraw THEN
    RAISE EXCEPTION 'Недостаточно средств на балансе водителя. Доступно: %', driver_balance;
  END IF;
  
  -- Создаем баланс для организации, если его нет
  INSERT INTO public.balances (user_id, amount, currency, updated_at)
  VALUES (organization_user_id, 0.00, 'BYN', NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 1. Списываем средства с баланса водителя (debit транзакция)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    related_user_id,
    created_at
  )
  VALUES (
    driver_user_id,
    amount_to_withdraw,
    'debit',
    'Изъятие кассы организацией',
    organization_user_id,
    NOW()
  );
  
  -- 2. Зачисляем средства на баланс организации (credit транзакция)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    related_user_id,
    created_at
  )
  VALUES (
    organization_user_id,
    amount_to_withdraw,
    'credit',
    'Получение кассы от водителя (изъятие организацией)',
    driver_user_id,
    NOW()
  );
  
  -- 3. Обновляем баланс водителя (все credit - только debit от сдачи кассы)
  SELECT public.calculate_driver_balance(driver_user_id) INTO calculated_balance;
  
  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = driver_user_id;
  
  -- 4. Обновляем баланс организации (все credit - все debit)
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE user_id = organization_user_id;
  
  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = organization_user_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_cash_from_driver(UUID, DECIMAL) TO authenticated;

-- Обновляем триггер handle_order_payment для использования новой логики расчета баланса
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
  IF NEW.is_paid = true 
     AND (OLD.is_paid IS NULL OR OLD.is_paid = false)
     AND NEW.executor_user_id IS NOT NULL THEN
   
    -- Проверяем, не создана ли уже транзакция через функцию process_order_payment
    IF EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE order_id = NEW.id 
        AND type = 'credit'
        AND created_at > NEW.updated_at - INTERVAL '1 second'
    ) THEN
      RAISE NOTICE 'Транзакция для заказа % уже создана через функцию. Пропускаем триггер.', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Создаем транзакцию
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
    
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    IF rows_inserted = 0 THEN
      RAISE EXCEPTION 'Не удалось создать транзакцию для заказа %', NEW.id;
    END IF;
    
    -- Рассчитываем баланс водителя (все credit - только debit от сдачи кассы)
    SELECT public.calculate_driver_balance(NEW.executor_user_id) INTO calculated_balance;
    
    -- Создаем или обновляем баланс
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (NEW.executor_user_id, calculated_balance, 'BYN', NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET 
      amount = calculated_balance,
      updated_at = NOW();
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Ошибка при обработке оплаты заказа %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Обновляем функцию process_order_payment для использования новой логики расчета баланса
DROP FUNCTION IF EXISTS public.process_order_payment CASCADE;

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
  IF order_uuid IS NULL THEN
    RAISE EXCEPTION 'order_uuid не может быть NULL';
  END IF;
  
  -- Получаем роль текущего пользователя
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IS NULL THEN
    RAISE WARNING 'Пользователь не найден в профилях';
    RETURN FALSE;
  END IF;
  
  -- Получаем заказ
  BEGIN
    SELECT * INTO STRICT order_record
    FROM public.orders o
    WHERE o.id = order_uuid
      AND (o.status = 'courier_delivering' OR o.status = 'completed');
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE WARNING 'Заказ не найден. order_uuid: %', order_uuid;
      RETURN FALSE;
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Найдено несколько заказов с одинаковым UUID: %', order_uuid;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Ошибка при получении заказа %: %', order_uuid, SQLERRM;
  END;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Проверяем права доступа и определяем, кому начисляются деньги
  IF caller_role = 'driver' THEN
    IF driver_user_id != auth.uid() THEN
      RAISE WARNING 'Водитель может провести оплату только для своих заказов';
      RETURN FALSE;
    END IF;
    recipient_user_id := driver_user_id;
  ELSIF caller_role = 'customer' THEN
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    IF driver_org_id IS NULL OR driver_org_id != auth.uid() THEN
      RAISE WARNING 'Организация может провести оплату только для заказов своих водителей';
      RETURN FALSE;
    END IF;
    recipient_user_id := auth.uid();
  ELSE
    RAISE WARNING 'Только водители и организации могут проводить оплату';
    RETURN FALSE;
  END IF;
  
  IF order_record.is_paid = true AND payment_status = true THEN
    DELETE FROM public.receivables WHERE order_id = order_uuid;
    RAISE NOTICE 'Заказ % уже оплачен. Дебиторка удалена, если существовала.', order_uuid;
    RETURN TRUE;
  END IF;
  
  IF order_record.is_paid = true AND payment_status = false THEN
    RAISE WARNING 'Нельзя пометить уже оплаченный заказ % как неоплаченный', order_uuid;
    RETURN FALSE;
  END IF;
  
  UPDATE public.orders
  SET is_paid = payment_status
  WHERE orders.id = order_uuid;
  
  IF payment_status THEN
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
      driver_user_id
    )
    RETURNING id INTO transaction_id;
    
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
    
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (recipient_user_id, calculated_balance, 'BYN', NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET 
      amount = calculated_balance,
      updated_at = NOW();
    
    RAISE NOTICE 'Транзакция создана для пользователя %: %, баланс обновлен: %', 
      recipient_user_id, transaction_id, calculated_balance;
    
    DELETE FROM public.receivables WHERE order_id = order_uuid;
    
    GET DIAGNOSTICS existing_receivable_id = ROW_COUNT;
    IF existing_receivable_id > 0 THEN
      RAISE NOTICE 'Дебиторка для заказа % удалена после оплаты', order_uuid;
    END IF;
  ELSE
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;
    
    IF existing_receivable_id IS NOT NULL THEN
      RAISE NOTICE 'Дебиторка для заказа % уже существует (id: %). Пропускаем создание.', order_uuid, existing_receivable_id;
      RETURN TRUE;
    END IF;
    
    IF order_record.paid_by = 'sender' THEN
      debtor_user_id := order_record.client_id;
    ELSE
      debtor_user_id := NULL;
    END IF;
    
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    
    INSERT INTO public.receivables (order_id, driver_user_id, organization_id, debtor_type, debtor_user_id, amount, currency, status, created_at, updated_at)
    VALUES (order_uuid, driver_user_id, driver_org_id, order_record.paid_by, debtor_user_id, order_record.final_price, 'BYN', 'unpaid', NOW(), NOW());
  END IF;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;

