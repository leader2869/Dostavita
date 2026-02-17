-- Миграция 099: Обновление логики оплаты - деньги идут тому, кто проводит оплату
-- Простая рабочая версия без лишних проверок

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
  -- Получаем роль текущего пользователя
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  
  IF caller_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid
    AND (status = 'courier_delivering' OR status = 'completed');
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Определяем, кому начисляются деньги
  IF caller_role = 'driver' AND driver_user_id = auth.uid() THEN
    recipient_user_id := driver_user_id;
  ELSIF caller_role = 'customer' THEN
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    IF driver_org_id = auth.uid() THEN
      recipient_user_id := auth.uid();
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
  
  -- Если заказ уже оплачен
  IF order_record.is_paid = true AND payment_status = true THEN
    DELETE FROM public.receivables WHERE order_id = order_uuid;
    RETURN TRUE;
  END IF;
  
  IF order_record.is_paid = true AND payment_status = false THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем статус оплаты
  UPDATE public.orders
  SET is_paid = payment_status
  WHERE id = order_uuid;
  
  IF payment_status THEN
    -- Создаем транзакцию для того, кто провел оплату
    INSERT INTO public.transactions (user_id, order_id, amount, type, description, created_at, related_user_id)
    VALUES (
      recipient_user_id,
      order_uuid,
      order_record.final_price,
      'credit',
      'Начисление за оплату Заказа №' || order_record.order_number::TEXT,
      COALESCE(order_record.completed_at, NOW()),
      driver_user_id
    )
    RETURNING id INTO transaction_id;
    
    -- Рассчитываем баланс
    SELECT COALESCE(SUM(amount), 0) INTO calculated_balance
    FROM public.transactions
    WHERE user_id = recipient_user_id AND type = 'credit';
    
    -- Обновляем баланс
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (recipient_user_id, calculated_balance, 'BYN', NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET amount = calculated_balance, updated_at = NOW();
    
    -- Удаляем дебиторку
    DELETE FROM public.receivables WHERE order_id = order_uuid;
  ELSE
    -- Создаем дебиторку
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;
    
    IF existing_receivable_id IS NULL THEN
      IF order_record.paid_by = 'sender' THEN
        debtor_user_id := order_record.client_id;
      ELSE
        debtor_user_id := NULL;
      END IF;
      
      SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
      
      INSERT INTO public.receivables (order_id, driver_user_id, organization_id, debtor_type, debtor_user_id, amount, currency, status, created_at, updated_at)
      VALUES (order_uuid, driver_user_id, driver_org_id, order_record.paid_by, debtor_user_id, order_record.final_price, 'BYN', 'unpaid', NOW(), NOW());
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;
