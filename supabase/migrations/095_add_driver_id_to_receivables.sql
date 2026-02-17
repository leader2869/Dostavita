-- Миграция 095: Добавление поля driver_user_id в таблицу receivables
-- Это позволит напрямую фильтровать дебиторку по водителю без JOIN через orders

-- Добавляем поле driver_user_id (ID водителя, который выполнил заказ)
ALTER TABLE public.receivables
ADD COLUMN IF NOT EXISTS driver_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Добавляем поле organization_id (ID организации водителя) для прямого фильтрования
ALTER TABLE public.receivables
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_receivables_driver_user_id ON public.receivables(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_organization_id ON public.receivables(organization_id);

-- Комментарии к полям
COMMENT ON COLUMN public.receivables.driver_user_id IS 'ID водителя, который выполнил заказ. Позволяет напрямую фильтровать дебиторку по водителю без JOIN через orders.';
COMMENT ON COLUMN public.receivables.organization_id IS 'ID организации водителя. Позволяет напрямую фильтровать дебиторку по организации без JOIN через profiles.';

-- Заполняем существующие записи driver_user_id и organization_id из orders и profiles
UPDATE public.receivables r
SET 
  driver_user_id = o.executor_user_id,
  organization_id = d.organization_id
FROM public.orders o
LEFT JOIN public.profiles d ON o.executor_user_id = d.id
WHERE r.order_id = o.id
  AND (r.driver_user_id IS NULL OR r.organization_id IS NULL);

-- Обновляем функцию process_order_payment, чтобы она сохраняла driver_user_id
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
    
    -- Получаем organization_id водителя
    SELECT organization_id INTO driver_org_id
    FROM public.profiles
    WHERE id = driver_user_id;
    
    -- Создаем запись о дебиторке с driver_user_id и organization_id
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
      driver_user_id, -- Сохраняем ID водителя напрямую
      driver_org_id, -- Сохраняем ID организации напрямую
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

-- Обновляем функцию get_organization_receivables для использования driver_user_id
DROP FUNCTION IF EXISTS public.get_organization_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_organization_receivables(
  organization_user_id UUID,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  order_number INTEGER,
  debtor_type TEXT,
  debtor_user_id UUID,
  debtor_name TEXT,
  debtor_phone TEXT,
  amount DECIMAL(10, 2),
  currency TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  driver_full_name TEXT,
  pickup_address TEXT,
  delivery_address TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Проверяем, что вызывающий пользователь является организацией
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF NOT FOUND OR caller_role != 'customer' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только организации могут просматривать дебиторку.';
  END IF;
  
  -- Проверяем, что organization_user_id совпадает с текущим пользователем
  IF organization_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы можете просматривать только свою дебиторку.';
  END IF;
  
  RETURN QUERY
  SELECT 
    r.id as id,
    r.order_id,
    o.order_number,
    r.debtor_type,
    r.debtor_user_id,
    CASE 
      WHEN r.debtor_type = 'sender' AND o.client_id IS NOT NULL THEN
        (SELECT p.full_name FROM public.profiles p WHERE p.id = o.client_id)
      WHEN r.debtor_type = 'recipient' THEN
        'Получатель (не зарегистрирован)'
      ELSE
        'Неизвестно'
    END as debtor_name,
    CASE 
      WHEN r.debtor_type = 'sender' THEN o.sender_phone
      WHEN r.debtor_type = 'recipient' THEN o.recipient_phone
      ELSE NULL
    END as debtor_phone,
    r.amount,
    r.currency,
    r.status,
    r.created_at,
    d.full_name as driver_full_name,
    o.pickup_address,
    o.delivery_address
  FROM public.receivables r
  INNER JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles d ON d.id = r.driver_user_id -- Для получения имени водителя
  WHERE r.status = 'unpaid'
    AND r.organization_id = organization_user_id -- Фильтруем напрямую по organization_id в receivables
    AND (start_date IS NULL OR r.created_at >= start_date)
    AND (end_date IS NULL OR r.created_at <= end_date)
  ORDER BY r.created_at DESC;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_organization_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Комментарий к функции
COMMENT ON FUNCTION public.get_organization_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Возвращает дебиторку (неоплаченные заказы) для организации. Использует driver_user_id для прямого фильтрования по водителям организации.';

-- Обновляем RLS политику для receivables, чтобы использовать driver_user_id
DROP POLICY IF EXISTS "Organizations can view receivables for their drivers' orders" ON public.receivables;

CREATE POLICY "Organizations can view receivables for their drivers' orders"
  ON public.receivables
  FOR SELECT
  USING (
    receivables.organization_id = auth.uid() -- Фильтруем напрямую по organization_id
  );

COMMENT ON POLICY "Organizations can view receivables for their drivers' orders" ON public.receivables IS 
  'Позволяет организациям видеть дебиторку по заказам своих водителей. Использует driver_user_id для прямого фильтрования.';

