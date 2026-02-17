-- Миграция 103: Добавление driver_user_id в результат функции get_organization_receivables
-- Это нужно для отображения дебиторки по водителям в разделе "Финансы по водителям"

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
  driver_user_id UUID,
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
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
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
    r.driver_user_id,  -- Добавляем driver_user_id в результат
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

GRANT EXECUTE ON FUNCTION public.get_organization_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_organization_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Возвращает дебиторку (неоплаченные заказы) для организации. Включает driver_user_id для связи с водителями.';

