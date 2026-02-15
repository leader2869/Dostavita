-- Миграция 066: RPC функция для получения заказов, от которых водитель отказался
-- Эти заказы должны быть скрыты из основного списка, но водитель может их снова увидеть

CREATE OR REPLACE FUNCTION public.get_driver_rejected_orders(p_driver_user_id UUID)
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
  SELECT DISTINCT
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
  INNER JOIN public.order_rejections r ON r.order_id = o.id
  WHERE r.driver_user_id = p_driver_user_id
    AND o.status = 'searching_courier'  -- Только активные заказы, от которых отказались
  ORDER BY r.created_at DESC
  LIMIT 10;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_rejected_orders: %', SQLERRM;
    RETURN;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_rejected_orders(UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.get_driver_rejected_orders(UUID) IS 
  'Возвращает заказы, от которых водитель отказался, но которые все еще активны (status = searching_courier). Использует SECURITY DEFINER для обхода RLS.';

