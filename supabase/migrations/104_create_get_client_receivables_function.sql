-- Миграция 104: Функция для получения дебиторки клиента
-- Клиент может видеть свои долги (неоплаченные заказы, где он является должником)

CREATE OR REPLACE FUNCTION public.get_client_receivables(
  client_user_id UUID,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  order_number INTEGER,
  debtor_type TEXT,
  amount DECIMAL(10, 2),
  currency TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  organization_id UUID,
  organization_name TEXT,
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
  -- Проверяем, что вызывающий пользователь является клиентом
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  IF NOT FOUND OR caller_role != 'client' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только клиенты могут просматривать свою дебиторку.';
  END IF;
  
  -- Проверяем, что client_user_id совпадает с текущим пользователем
  IF client_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы можете просматривать только свою дебиторку.';
  END IF;
  
  RETURN QUERY
  SELECT 
    r.id as id,
    r.order_id,
    o.order_number,
    r.debtor_type,
    r.amount,
    r.currency,
    r.status,
    r.created_at,
    r.organization_id,
    org.full_name as organization_name,
    d.full_name as driver_full_name,
    o.pickup_address,
    o.delivery_address
  FROM public.receivables r
  INNER JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles d ON d.id = r.driver_user_id
  LEFT JOIN public.profiles org ON org.id = r.organization_id
  WHERE r.status = 'unpaid'
    AND r.debtor_type = 'sender'
    AND r.debtor_user_id = client_user_id
    AND (start_date IS NULL OR r.created_at >= start_date)
    AND (end_date IS NULL OR r.created_at <= end_date)
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_client_receivables(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Возвращает дебиторку (неоплаченные заказы) для клиента, где клиент является должником (debtor_type = sender).';

