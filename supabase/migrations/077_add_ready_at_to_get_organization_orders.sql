-- Миграция 077: Добавление поля ready_at в функцию get_organization_orders
-- Это поле нужно для отображения времени готовности заказа в деталях заказа для организаций

-- Удаляем старую функцию, чтобы изменить тип возврата
DROP FUNCTION IF EXISTS public.get_organization_orders(UUID);

-- Создаем функцию заново с новым полем ready_at
CREATE FUNCTION public.get_organization_orders(organization_user_id UUID)
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
  ready_at TIMESTAMPTZ,
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
    o.ready_at,
    o.final_price,
    o.created_at,
    o.accepted_at,
    o.picked_up_at,
    o.completed_at,
    d.full_name as driver_full_name,
    d.phone as driver_phone
  FROM public.orders o
  INNER JOIN public.profiles d ON o.executor_user_id = d.id
  INNER JOIN public.driver_organization_history h ON h.driver_user_id = d.id
    AND h.organization_user_id = organization_user_id
  WHERE d.role = 'driver'
    -- Показываем только заказы, которые были приняты ПОСЛЕ привязки водителя к организации
    AND (
      o.accepted_at IS NULL 
      OR o.accepted_at >= h.attached_at
    )
  ORDER BY o.created_at DESC;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Ошибка в get_organization_orders: %', SQLERRM;
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_organization_orders(UUID) IS 'Возвращает заказы организации. Включает поле ready_at для отображения времени готовности заказа.';

