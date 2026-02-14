-- Миграция 056: Обновление функции get_organization_drivers_with_active_orders
-- Теперь функция возвращает ВСЕХ водителей организации, а не только с активными заказами
-- Информация об активных заказах добавляется, если они есть

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

  -- Используем LEFT JOIN вместо INNER JOIN, чтобы вернуть всех водителей
  -- даже если у них нет активных заказов
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    COALESCE(p.email, '')::TEXT as email,
    COALESCE(p.full_name, '')::TEXT as full_name,
    COALESCE(p.phone, '')::TEXT as phone,
    COALESCE(p.vehicle_type, '')::TEXT as vehicle_type,
    COALESCE(p.vehicle_number, '')::TEXT as vehicle_number,
    COALESCE(p.license_number, '')::TEXT as license_number,
    -- Возвращаем current_location для всех водителей (не только с активными заказами)
    p.current_location,
    -- Возвращаем location_updated_at для всех водителей
    p.location_updated_at,
    COALESCE(p.avatar_url, '')::TEXT as avatar_url,
    p.created_at,
    -- ID активного заказа (если есть)
    o.id as active_order_id,
    -- Статус активного заказа (если есть)
    COALESCE(o.status, '')::TEXT as active_order_status
  FROM public.profiles p
  LEFT JOIN public.orders o ON o.executor_user_id = p.id
    AND o.status IN ('courier_coming', 'courier_delivering')
  WHERE p.organization_id = organization_user_id
    AND p.role = 'driver'
  ORDER BY p.id, o.created_at DESC NULLS LAST;
EXCEPTION
  WHEN OTHERS THEN
    -- В случае ошибки возвращаем пустой результат
    RAISE WARNING 'Ошибка в get_organization_drivers_with_active_orders: %', SQLERRM;
    RETURN;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_organization_drivers_with_active_orders(UUID) TO authenticated;

-- Обновляем RPC функцию get_driver_location_for_order: организация может видеть местоположение своих водителей всегда
CREATE OR REPLACE FUNCTION public.get_driver_location_for_order(
  p_driver_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  latitude DECIMAL,
  longitude DECIMAL,
  accuracy DECIMAL,
  heading DECIMAL,
  speed DECIMAL,
  updated_at TIMESTAMPTZ,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_has_access BOOLEAN := FALSE;
BEGIN
  -- Получаем текущего пользователя
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Получаем роль пользователя (отключаем RLS для предотвращения рекурсии)
  PERFORM set_config('row_security', 'off', true);
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;
  PERFORM set_config('row_security', 'on', true);

  -- Проверяем доступ
  -- 1. Водитель может видеть свое местоположение
  IF v_user_id = p_driver_id THEN
    v_has_access := TRUE;
  END IF;

  -- 2. Клиент может видеть местоположение водителя для своего заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
    ) INTO v_has_access;
  END IF;

  -- 3. Организация может видеть местоположение своих водителей ВСЕГДА (без ограничения на активные заказы)
  IF NOT v_has_access AND v_user_role = 'customer' THEN
    PERFORM set_config('row_security', 'off', true);
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_driver_id
        AND organization_id = v_user_id
        AND role = 'driver'
    ) INTO v_has_access;
    PERFORM set_config('row_security', 'on', true);
  END IF;

  -- 4. Суперадмин может видеть все
  IF NOT v_has_access AND v_user_role = 'superadmin' THEN
    v_has_access := TRUE;
  END IF;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  -- Возвращаем последнее местоположение из driver_locations
  RETURN QUERY
  SELECT
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.updated_at,
    'driver_locations'::TEXT as source
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND (p_order_id IS NULL OR dl.order_id = p_order_id)
  ORDER BY dl.updated_at DESC
  LIMIT 1;

  -- Если нет в driver_locations, возвращаем из profiles
  IF NOT FOUND THEN
    DECLARE
      v_location_text TEXT;
      v_lat DECIMAL;
      v_lon DECIMAL;
    BEGIN
      PERFORM set_config('row_security', 'off', true);
      SELECT current_location::TEXT INTO v_location_text
      FROM public.profiles
      WHERE id = p_driver_id
        AND current_location IS NOT NULL;
      PERFORM set_config('row_security', 'on', true);
      
      IF v_location_text IS NOT NULL THEN
        -- Парсим формат "(lon,lat)" или "POINT(lon lat)"
        v_location_text := REPLACE(REPLACE(v_location_text, 'POINT(', ''), ')', '');
        v_location_text := REPLACE(REPLACE(v_location_text, '(', ''), ')', '');
        
        -- Разделяем по пробелу или запятой
        IF POSITION(' ' IN v_location_text) > 0 THEN
          v_lon := SPLIT_PART(v_location_text, ' ', 1)::DECIMAL;
          v_lat := SPLIT_PART(v_location_text, ' ', 2)::DECIMAL;
        ELSIF POSITION(',' IN v_location_text) > 0 THEN
          v_lon := SPLIT_PART(v_location_text, ',', 1)::DECIMAL;
          v_lat := SPLIT_PART(v_location_text, ',', 2)::DECIMAL;
        END IF;
        
        IF v_lat IS NOT NULL AND v_lon IS NOT NULL THEN
          PERFORM set_config('row_security', 'off', true);
          RETURN QUERY
          SELECT
            v_lat as latitude,
            v_lon as longitude,
            NULL::DECIMAL as accuracy,
            NULL::DECIMAL as heading,
            NULL::DECIMAL as speed,
            (SELECT location_updated_at FROM public.profiles WHERE id = p_driver_id) as updated_at,
            'profiles'::TEXT as source;
          PERFORM set_config('row_security', 'on', true);
        END IF;
      END IF;
    END;
  END IF;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_location_for_order(UUID, UUID) TO authenticated;

-- Обновляем комментарий
COMMENT ON FUNCTION public.get_organization_drivers_with_active_orders(UUID) IS 
  'Возвращает всех водителей организации с информацией об активных заказах (если есть). Водители без активных заказов также возвращаются.';

COMMENT ON FUNCTION public.get_driver_location_for_order(UUID, UUID) IS 
  'Безопасное получение местоположения водителя. Организация может видеть местоположение своих водителей всегда.';

