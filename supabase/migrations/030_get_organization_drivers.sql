-- Миграция 030: RPC функция для получения водителей организации

-- Функция для получения всех водителей организации
CREATE OR REPLACE FUNCTION public.get_organization_drivers(organization_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  current_location POINT,
  location_updated_at TIMESTAMPTZ,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.vehicle_type,
    p.vehicle_number,
    p.license_number,
    p.current_location,
    p.location_updated_at,
    p.avatar_url,
    p.created_at
  FROM public.profiles p
  WHERE p.organization_id = organization_user_id
    AND p.role = 'driver'
  ORDER BY p.created_at DESC;
END;
$$;

-- Функция для получения заказов водителей организации
CREATE OR REPLACE FUNCTION public.get_organization_orders(organization_user_id UUID)
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  customer_id UUID,
  client_id UUID,
  executor_user_id UUID,
  status TEXT,
  pickup_address TEXT,
  delivery_address TEXT,
  item_type TEXT,
  description TEXT,
  final_price DECIMAL(10, 2),
  created_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  driver_full_name TEXT,
  driver_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.customer_id,
    o.client_id,
    o.executor_user_id,
    o.status,
    o.pickup_address,
    o.delivery_address,
    o.item_type,
    o.description,
    o.final_price,
    o.created_at,
    o.accepted_at,
    o.picked_up_at,
    o.completed_at,
    d.full_name as driver_full_name,
    d.phone as driver_phone
  FROM public.orders o
  LEFT JOIN public.profiles d ON o.executor_user_id = d.id
  WHERE o.executor_user_id IN (
    SELECT p.id 
    FROM public.profiles p 
    WHERE p.organization_id = organization_user_id 
      AND p.role = 'driver'
  )
  ORDER BY o.created_at DESC;
END;
$$;

-- Функция для получения финансов водителей организации
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
    d.id as driver_id,
    d.full_name as driver_full_name,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed') as completed_orders_count,
    COALESCE(SUM(o.final_price) FILTER (WHERE o.status = 'completed'), 0) as total_earnings,
    COALESCE(b.amount, 0) as balance
  FROM public.profiles d
  LEFT JOIN public.orders o ON o.executor_user_id = d.id
  LEFT JOIN public.balances b ON b.user_id = d.id
  WHERE d.organization_id = organization_user_id
    AND d.role = 'driver'
    AND (start_date IS NULL OR o.completed_at >= start_date)
    AND (end_date IS NULL OR o.completed_at <= end_date)
  GROUP BY d.id, d.full_name, b.amount
  ORDER BY d.full_name;
END;
$$;

