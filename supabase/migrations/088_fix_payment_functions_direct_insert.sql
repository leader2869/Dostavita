-- Миграция 088: Исправление функций обработки оплаты с прямым INSERT
-- Проблема: set_config не работает для функций с SECURITY DEFINER в Supabase
-- Решение: используем прямой INSERT/UPDATE без set_config, полагаясь на SECURITY DEFINER

-- Удаляем старые функции
DROP FUNCTION IF EXISTS public.create_transaction(UUID, UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_or_update_balance(UUID, DECIMAL);
DROP FUNCTION IF EXISTS public.process_order_payment(UUID, BOOLEAN);

-- Функция для создания транзакции (прямой INSERT без set_config)
CREATE OR REPLACE FUNCTION public.create_transaction(
  p_user_id UUID,
  p_order_id UUID,
  p_amount DECIMAL(10, 2),
  p_type TEXT,
  p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  -- Прямой INSERT - SECURITY DEFINER должен обходить RLS
  INSERT INTO public.transactions (user_id, order_id, amount, type, description)
  VALUES (p_user_id, p_order_id, p_amount, p_type, p_description);
  
  -- Проверяем, что INSERT выполнился
  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  IF rows_inserted = 0 THEN
    RAISE EXCEPTION 'Не удалось создать транзакцию для пользователя %, заказа %', p_user_id, p_order_id;
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Ошибка при создании транзакции: %', SQLERRM;
END;
$$;

-- Функция для создания/обновления баланса (прямой INSERT/UPDATE без set_config)
-- Баланс = сумма всех транзакций типа 'credit' (оплаченные заказы)
CREATE OR REPLACE FUNCTION public.create_or_update_balance(
  p_user_id UUID,
  p_amount DECIMAL(10, 2)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_balance DECIMAL(10, 2);
BEGIN
  -- Создаем баланс, если его нет (прямой INSERT - SECURITY DEFINER должен обходить RLS)
  INSERT INTO public.balances (user_id, amount, currency, updated_at)
  VALUES (p_user_id, 0, 'BYN', NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Рассчитываем баланс как сумму всех транзакций типа 'credit'
  SELECT COALESCE(SUM(amount), 0) INTO calculated_balance
  FROM public.transactions
  WHERE user_id = p_user_id
    AND type = 'credit';
  
  -- Обновляем баланс на основе всех транзакций (прямой UPDATE - SECURITY DEFINER должен обходить RLS)
  UPDATE public.balances
  SET 
    amount = calculated_balance,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Ошибка при обновлении баланса: %', SQLERRM;
END;
$$;

-- Основная функция process_order_payment
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
  balance_updated BOOLEAN;
  transaction_created BOOLEAN;
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
    -- Если оплата получена, сначала создаем транзакцию
    BEGIN
      SELECT public.create_transaction(
        driver_user_id,
        order_uuid,
        order_record.final_price,
        'credit',
        'Начисление за выполнение Заказа №' || order_record.order_number::TEXT
      ) INTO transaction_created;
      
      IF NOT transaction_created THEN
        RAISE EXCEPTION 'Не удалось создать транзакцию для заказа %', order_uuid;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Ошибка при создании транзакции для заказа %: %', order_uuid, SQLERRM;
    END;
    
    -- Затем пересчитываем баланс на основе всех транзакций типа 'credit'
    -- Баланс = сумма всех транзакций типа 'credit' (оплаченные заказы)
    BEGIN
      SELECT public.create_or_update_balance(driver_user_id, order_record.final_price) INTO balance_updated;
      
      IF NOT balance_updated THEN
        RAISE WARNING 'Не удалось обновить баланс для пользователя %', driver_user_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Ошибка при обновлении баланса для пользователя %: %', driver_user_id, SQLERRM;
    END;
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

COMMENT ON FUNCTION public.process_order_payment(UUID, BOOLEAN) IS 'Обрабатывает оплату заказа: начисляет деньги водителю или создает дебиторку. Использует вспомогательные функции для обхода RLS. Баланс = сумма всех транзакций типа credit (оплаченные заказы).';

COMMENT ON FUNCTION public.create_or_update_balance(UUID, DECIMAL) IS 'Создает или обновляет баланс пользователя. Баланс = сумма всех транзакций типа credit (оплаченные заказы). Использует SECURITY DEFINER для обхода RLS.';

COMMENT ON FUNCTION public.create_transaction(UUID, UUID, DECIMAL, TEXT, TEXT) IS 'Создает транзакцию. Использует SECURITY DEFINER для обхода RLS.';

-- Даем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_update_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transaction(UUID, UUID, DECIMAL, TEXT, TEXT) TO authenticated;

