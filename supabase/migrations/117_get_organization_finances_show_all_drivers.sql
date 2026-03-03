-- Финансы по водителям организации: всегда возвращать ВСЕХ водителей организации.
-- Фильтр по датам применяется только к подсчёту заказов и сумм (в JOIN), а не к списку водителей.
CREATE OR REPLACE FUNCTION public.get_organization_finances(organization_user_id UUID, start_date TIMESTAMPTZ DEFAULT NULL, end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  driver_id UUID,
  driver_full_name TEXT,
  completed_orders_count BIGINT,
  total_earnings DECIMAL(10, 2),
  balance DECIMAL(10, 2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS driver_id,
    d.full_name AS driver_full_name,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed') AS completed_orders_count,
    COALESCE(SUM(o.final_price) FILTER (WHERE o.status = 'completed'), 0) AS total_earnings,
    COALESCE(b.amount, 0) AS balance
  FROM public.profiles d
  LEFT JOIN public.orders o ON o.executor_user_id = d.id
    AND (start_date IS NULL OR o.completed_at >= start_date)
    AND (end_date IS NULL OR o.completed_at <= end_date)
  LEFT JOIN public.balances b ON b.user_id = d.id
  WHERE d.organization_id = organization_user_id
    AND d.role = 'driver'
  GROUP BY d.id, d.full_name, b.amount
  ORDER BY d.full_name;
END;
$$;
