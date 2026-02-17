-- Миграция 086: Исправление функции process_order_payment для работы с RLS
-- Проблема: set_config('row_security', 'off', true) не работает для INSERT/UPDATE в Supabase
-- Решение: используем прямой доступ через SECURITY DEFINER без set_config
-- SECURITY DEFINER функции должны автоматически обходить RLS в Supabase

-- Удаляем старую функцию
DROP FUNCTION IF EXISTS public.process_order_payment(UUID, BOOLEAN);

-- Создаем функцию заново без set_config, полагаясь на SECURITY DEFINER
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
  current_balance DECIMAL(10, 2);
  new_balance DECIMAL(10, 2);
  rows_updated INTEGER;
BEGIN
  -- Получаем заказ (можно обрабатывать оплату только для заказов в статусе "доставляет" или "завершен")
  -- Оплата еще не обработана, если is_paid IS NULL или is_paid = false
  SELECT * INTO order_record
  FROM public.orders o
  WHERE o.id = order_uuid 
    AND (o.status = 'courier_delivering' OR o.status = 'completed')
    AND o.executor_user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE WARNING 'Заказ не найден или не принадлежит текущему водителю: %', order_uuid;
    RETURN FALSE;
  END IF;
  
  -- Проверяем, что оплата еще не обработана (is_paid IS NULL или is_paid = false)
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
  UPDATE public.orders
  SET 
    is_paid = payment_status
  WHERE orders.id = order_uuid;
  
  IF payment_status THEN
    -- Если оплата получена, начисляем средства водителю
    -- SECURITY DEFINER должен автоматически обходить RLS в Supabase
    
    -- Получаем текущий баланс (если существует)
    SELECT COALESCE(amount, 0) INTO current_balance
    FROM public.balances
    WHERE user_id = driver_user_id;
    
    -- Если баланса нет, создаем его
    IF current_balance IS NULL THEN
      INSERT INTO public.balances (user_id, amount, currency, updated_at)
      VALUES (driver_user_id, 0, 'BYN', NOW())
      ON CONFLICT (user_id) DO NOTHING;
      
      -- Проверяем, что баланс создан
      SELECT COALESCE(amount, 0) INTO current_balance
      FROM public.balances
      WHERE user_id = driver_user_id;
      
      IF current_balance IS NULL THEN
        RAISE EXCEPTION 'Не удалось создать баланс для пользователя %', driver_user_id;
      END IF;
    END IF;
    
    -- Начисляем средства
    UPDATE public.balances
    SET 
      amount = amount + order_record.final_price,
      updated_at = NOW()
    WHERE user_id = driver_user_id;
    
    -- Проверяем, что UPDATE выполнился
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    IF rows_updated = 0 THEN
      RAISE EXCEPTION 'UPDATE баланса не выполнился для пользователя %. Текущий баланс: %, final_price: %', 
        driver_user_id, current_balance, order_record.final_price;
    END IF;
    
    -- Проверяем, что баланс обновился
    SELECT amount INTO new_balance
    FROM public.balances
    WHERE user_id = driver_user_id;
    
    IF new_balance IS NULL OR new_balance <= current_balance THEN
      RAISE EXCEPTION 'Баланс не обновился для пользователя %. Текущий: %, Ожидаемый: %, final_price: %', 
        driver_user_id, current_balance, COALESCE(current_balance, 0) + order_record.final_price, order_record.final_price;
    END IF;
    
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
$$;

COMMENT ON FUNCTION public.process_order_payment(UUID, BOOLEAN) IS 'Обрабатывает оплату заказа: начисляет деньги водителю или создает дебиторку. Принимает заказы с is_paid = false или is_paid IS NULL. Параметр payment_status: true - оплата получена, false - оплата не получена. Использует SECURITY DEFINER для обхода RLS.';

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;

