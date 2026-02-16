-- Миграция 082: Функция для получения дебиторки организации
-- Эта функция возвращает все неоплаченные заказы водителей организации

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
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.order_id,
    o.order_number,
    r.debtor_type,
    r.debtor_user_id,
    CASE 
      WHEN r.debtor_type = 'sender' AND o.client_id IS NOT NULL THEN
        (SELECT full_name FROM public.profiles WHERE id = o.client_id)
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
  INNER JOIN public.profiles d ON o.executor_user_id = d.id
  WHERE r.status = 'unpaid'
    AND d.organization_id = organization_user_id
    AND (start_date IS NULL OR r.created_at >= start_date)
    AND (end_date IS NULL OR r.created_at <= end_date)
  ORDER BY r.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_organization_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Возвращает дебиторку (неоплаченные заказы) для организации';

