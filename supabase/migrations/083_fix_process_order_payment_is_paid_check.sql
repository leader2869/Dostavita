-- Миграция 083: Исправление проверки is_paid в функции process_order_payment
-- Проблема: функция проверяла только is_paid IS NULL, но по умолчанию is_paid = false
-- Решение: изменить проверку, чтобы она работала и с false, и с null

-- Обновляем функцию process_order_payment
CREATE OR REPLACE FUNCTION public.process_order_payment(
  order_uuid UUID,
  is_paid BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  driver_user_id UUID;
  debtor_user_id UUID;
BEGIN
  -- Получаем заказ (можно обрабатывать оплату только для заказов в статусе "доставляет" или "завершен")
  -- Оплата еще не обработана, если is_paid IS NULL или is_paid = false
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid 
    AND (status = 'courier_delivering' OR status = 'completed')
    AND executor_user_id = auth.uid()
    AND (is_paid IS NULL OR is_paid = false); -- Оплата еще не обработана
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем статус оплаты заказа
  UPDATE public.orders
  SET 
    is_paid = is_paid,
    updated_at = NOW()
  WHERE id = order_uuid;
  
  IF is_paid THEN
    -- Если оплата получена, начисляем средства водителю
    -- Убеждаемся, что баланс существует
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (driver_user_id, 0, 'BYN', NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Начисляем средства
    UPDATE public.balances
    SET 
      amount = amount + order_record.final_price,
      updated_at = NOW()
    WHERE user_id = driver_user_id;
    
    -- Создаем транзакцию
    INSERT INTO public.transactions (user_id, order_id, amount, type, description)
    VALUES (
      driver_user_id,
      order_uuid,
      order_record.final_price,
      'credit',
      'Начисление за выполнение Заказа №' || order_record.order_number::TEXT
    );
  ELSE
    -- Если оплата не получена, создаем запись о дебиторке
    -- Определяем, кто должен платить
    IF order_record.paid_by = 'sender' THEN
      debtor_user_id := order_record.client_id;
    ELSE
      -- Если получатель должен платить, нужно найти его user_id
      -- Пока оставляем NULL, так как получатель может быть не зарегистрирован
      debtor_user_id := NULL;
    END IF;
    
    -- Создаем запись о дебиторке
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.process_order_payment(UUID, BOOLEAN) IS 'Обрабатывает оплату заказа: начисляет деньги водителю или создает дебиторку. Принимает заказы с is_paid = false или is_paid IS NULL';

