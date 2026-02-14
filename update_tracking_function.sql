-- Обновление функции get_organization_drivers_with_active_orders
-- Убираем проверку o.customer_id = organization_user_id
-- Теперь организация видит всех своих водителей с активными заказами, независимо от того, кто создал заказ

CREATE OR REPLACE FUNCTION public.get_organization_drivers_with_active_orders(organization_user_id UUID)
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
  created_at TIMESTAMPTZ,
  active_order_id UUID,
  active_order_status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Проверяем, что organization_user_id не NULL
  IF organization_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Используем явное указание схемы и обходим RLS через SECURITY DEFINER
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    COALESCE(p.email, '')::TEXT as email,
    COALESCE(p.full_name, '')::TEXT as full_name,
    COALESCE(p.phone, '')::TEXT as phone,
    COALESCE(p.vehicle_type, '')::TEXT as vehicle_type,
    COALESCE(p.vehicle_number, '')::TEXT as vehicle_number,
    COALESCE(p.license_number, '')::TEXT as license_number,
    -- Возвращаем current_location только если есть активный заказ
    p.current_location,
    -- Возвращаем location_updated_at только если есть активный заказ
    p.location_updated_at,
    COALESCE(p.avatar_url, '')::TEXT as avatar_url,
    p.created_at,
    o.id as active_order_id,
    COALESCE(o.status, '')::TEXT as active_order_status
  FROM public.profiles p
  INNER JOIN public.orders o ON o.executor_user_id = p.id
    AND o.status IN ('courier_coming', 'courier_delivering')
  WHERE p.organization_id = organization_user_id
    AND p.role = 'driver'
  ORDER BY p.id, o.created_at DESC;
EXCEPTION
  WHEN OTHERS THEN
    -- В случае ошибки возвращаем пустой результат
    RAISE WARNING 'Ошибка в get_organization_drivers_with_active_orders: %', SQLERRM;
    RETURN;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_organization_drivers_with_active_orders(UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.get_organization_drivers_with_active_orders(UUID) IS 
  'Возвращает водителей организации только с активными заказами, включая их местоположение. Организация видит всех своих водителей с активными заказами, независимо от того, кто создал заказ (клиент или организация).';

