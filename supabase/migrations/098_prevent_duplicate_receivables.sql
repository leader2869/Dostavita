-- Миграция 098: Предотвращение создания дубликатов дебиторки для одного заказа
-- Проблема: дебиторка создается дважды для одного и того же заказа

-- 1. СНАЧАЛА удаляем дубликаты (если они есть) - оставляем только самую раннюю запись
-- Это нужно сделать ДО создания UNIQUE constraint
-- Используем ROW_NUMBER() для определения записей, которые нужно оставить
DELETE FROM public.receivables
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at ASC, id ASC) as rn
    FROM public.receivables
  ) ranked
  WHERE rn > 1 -- Оставляем только первую запись для каждого order_id
);

-- 2. Удаляем старый constraint, если он существует (на случай повторного применения)
ALTER TABLE public.receivables
DROP CONSTRAINT IF EXISTS receivables_order_id_unique;

-- 3. Добавляем UNIQUE constraint на order_id в таблице receivables
-- Один заказ может иметь только одну дебиторку
ALTER TABLE public.receivables
ADD CONSTRAINT receivables_order_id_unique UNIQUE (order_id);

-- Комментарий к constraint
COMMENT ON CONSTRAINT receivables_order_id_unique ON public.receivables IS 
  'Предотвращает создание нескольких записей дебиторки для одного заказа. Один заказ = одна дебиторка.';

-- 3. Обновляем функцию process_order_payment, чтобы проверять существование дебиторки
DROP FUNCTION IF EXISTS public.process_order_payment(UUID, BOOLEAN);

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
BEGIN
  -- Валидация входного параметра
  IF order_uuid IS NULL THEN
    RAISE EXCEPTION 'order_uuid не может быть NULL';
  END IF;
  
  -- Получаем заказ (можно обрабатывать оплату только для заказов в статусе "доставляет" или "завершен")
  -- Используем явное приведение к UUID, которое вызовет ошибку, если передан невалидный UUID
  -- PostgreSQL автоматически проверит валидность UUID при приведении типа
  BEGIN
    SELECT * INTO STRICT order_record
    FROM public.orders o
    WHERE o.id = order_uuid  -- order_uuid уже имеет тип UUID, приведение не требуется
      AND (o.status = 'courier_delivering' OR o.status = 'completed')
      AND o.executor_user_id = auth.uid();
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE WARNING 'Заказ не найден или не принадлежит текущему водителю. order_uuid: %, executor_user_id: %', order_uuid, auth.uid();
      RETURN FALSE;
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Найдено несколько заказов с одинаковым UUID: %', order_uuid;
    WHEN OTHERS THEN
      -- Если ошибка связана с невалидным UUID, PostgreSQL выдаст ошибку до выполнения функции
      -- Но на всякий случай перехватываем другие ошибки
      RAISE EXCEPTION 'Ошибка при получении заказа %: %', order_uuid, SQLERRM;
  END;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Если заказ уже оплачен (is_paid = true), но мы пытаемся снова пометить как оплаченный
  -- Просто удаляем дебиторку, если она есть, и выходим
  IF order_record.is_paid = true AND payment_status = true THEN
    -- Удаляем дебиторку, если она существует (на случай, если была создана ранее)
    DELETE FROM public.receivables
    WHERE order_id = order_uuid;
    RAISE NOTICE 'Заказ % уже оплачен. Дебиторка удалена, если существовала.', order_uuid;
    RETURN TRUE;
  END IF;
  
  -- Если заказ уже оплачен, но мы пытаемся пометить как неоплаченный - не разрешаем
  IF order_record.is_paid = true AND payment_status = false THEN
    RAISE WARNING 'Нельзя пометить уже оплаченный заказ % как неоплаченный', order_uuid;
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
    -- Удаляем дебиторку, если она была создана ранее (ВАЖНО: делаем это ПОСЛЕ обновления is_paid)
    DELETE FROM public.receivables
    WHERE order_id = order_uuid;
    
    -- Проверяем, что дебиторка была удалена
    GET DIAGNOSTICS existing_receivable_id = ROW_COUNT;
    IF existing_receivable_id > 0 THEN
      RAISE NOTICE 'Дебиторка для заказа % удалена после оплаты', order_uuid;
    END IF;
  ELSE
    -- Если оплата не получена, проверяем, существует ли уже дебиторка для этого заказа
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;
    
    -- Если дебиторка уже существует, не создаем новую
    IF existing_receivable_id IS NOT NULL THEN
      RAISE NOTICE 'Дебиторка для заказа % уже существует (id: %). Пропускаем создание.', order_uuid, existing_receivable_id;
      RETURN TRUE;
    END IF;
    
    -- Определяем должника
    IF order_record.paid_by = 'sender' THEN
      debtor_user_id := order_record.client_id;
    ELSE
      debtor_user_id := NULL;
    END IF;
    
    -- Получаем organization_id водителя
    SELECT organization_id INTO driver_org_id
    FROM public.profiles
    WHERE id = driver_user_id;
    
    -- Создаем запись о дебиторке с driver_user_id и organization_id
    -- Используем ON CONFLICT для защиты от дубликатов (на случай параллельных запросов)
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
      order_record.paid_by,
      debtor_user_id,
      order_record.final_price,
      'BYN',
      'unpaid',
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO NOTHING; -- Если дебиторка уже существует, ничего не делаем
    
    -- Проверяем, что запись была создана
    IF NOT FOUND THEN
      RAISE NOTICE 'Дебиторка для заказа % не была создана (возможно, уже существует из-за параллельного запроса)', order_uuid;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.process_order_payment(UUID, BOOLEAN) TO authenticated;

-- Комментарий к функции
COMMENT ON FUNCTION public.process_order_payment(UUID, BOOLEAN) IS 
  'Обрабатывает оплату заказа. Предотвращает создание дубликатов дебиторки. Обновляет is_paid, триггер автоматически создает транзакцию и обновляет баланс.';

