-- Миграция 015: RPC функция для получения всех заказов для админа (обходит RLS)
-- Эта функция позволяет админам получать все заказы

CREATE OR REPLACE FUNCTION public.get_all_orders_for_admin(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  customer_id UUID,
  client_id UUID,
  driver_id UUID,
  executor_user_id UUID,
  status TEXT,
  visibility TEXT,
  pickup_address TEXT,
  pickup_coordinates POINT,
  delivery_address TEXT,
  delivery_coordinates POINT,
  description TEXT,
  weight DECIMAL(10, 2),
  volume DECIMAL(10, 2),
  item_type TEXT,
  courier_comment TEXT,
  base_price DECIMAL(10, 2),
  region_id UUID,
  final_price DECIMAL(10, 2),
  is_paid BOOLEAN,
  created_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  started_delivery_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.customer_id,
    o.client_id,
    o.driver_id,
    o.executor_user_id,
    o.status,
    o.visibility,
    o.pickup_address,
    o.pickup_coordinates,
    o.delivery_address,
    o.delivery_coordinates,
    o.description,
    o.weight,
    o.volume,
    o.item_type,
    o.courier_comment,
    o.base_price,
    o.region_id,
    o.final_price,
    o.is_paid,
    o.created_at,
    o.accepted_at,
    o.picked_up_at,
    o.started_delivery_at,
    o.completed_at,
    o.cancelled_at
  FROM public.orders o
  ORDER BY o.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_all_orders_for_admin(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_orders_for_admin(INTEGER) TO anon;







