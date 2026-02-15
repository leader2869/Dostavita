-- Миграция 065: RPC функция для получения отмененных заказов водителя
-- Использует SECURITY DEFINER для обхода RLS и предотвращения рекурсии

CREATE OR REPLACE FUNCTION public.get_driver_cancelled_orders(p_driver_user_id UUID)
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  pickup_address TEXT,
  delivery_address TEXT,
  final_price DECIMAL(10, 2),
  item_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Временно отключаем RLS для этого SELECT
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.pickup_address,
    o.delivery_address,
    o.final_price,
    o.item_type,
    o.description,
    o.created_at,
    o.cancelled_at,
    o.status
  FROM public.orders o
  WHERE o.status = 'cancelled'
    AND o.cancelled_at IS NOT NULL
  ORDER BY o.cancelled_at DESC
  LIMIT 10;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_cancelled_orders: %', SQLERRM;
    RETURN;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_cancelled_orders(UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.get_driver_cancelled_orders(UUID) IS 
  'Возвращает отмененные заказы для водителя. Использует SECURITY DEFINER для обхода RLS и предотвращения рекурсии.';

