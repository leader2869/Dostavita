-- Миграция 052: Ограничение доступа организации к местоположению водителя только для активных заказов

-- Обновляем RLS политику для profiles: организация может видеть current_location только для водителей с активными заказами
DROP POLICY IF EXISTS "Organizations can view their drivers location" ON public.profiles;
CREATE POLICY "Organizations can view their drivers location for active orders"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
    OR
    -- Организация может видеть current_location своих водителей ТОЛЬКО если у них есть активный заказ
    (
      profiles.organization_id = auth.uid()
      AND profiles.role = 'driver'
      AND EXISTS (
        -- Проверяем, что текущий пользователь - организация (customer)
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'customer'
        LIMIT 1
      )
      AND EXISTS (
        -- Проверяем, что у водителя есть активный заказ организации
        SELECT 1 FROM public.orders o
        WHERE o.executor_user_id = profiles.id
          AND o.customer_id = auth.uid()
          AND o.status IN ('courier_coming', 'courier_delivering')
      )
    )
  );

-- Обновляем RLS политику для driver_locations: организация может видеть местоположение только для активных заказов
DROP POLICY IF EXISTS "Organizations can view their drivers locations" ON public.driver_locations;
CREATE POLICY "Organizations can view their drivers locations for active orders"
  ON public.driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = driver_locations.driver_id
        AND profiles.organization_id = auth.uid()
        AND profiles.role = 'driver'
    )
    AND (
      -- Если есть order_id, проверяем что это активный заказ организации
      (order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = driver_locations.order_id
          AND orders.customer_id = auth.uid()
          AND orders.status IN ('courier_coming', 'courier_delivering')
      ))
      OR
      -- Если order_id нет, проверяем что у водителя есть активный заказ организации
      (order_id IS NULL AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.executor_user_id = driver_locations.driver_id
          AND orders.customer_id = auth.uid()
          AND orders.status IN ('courier_coming', 'courier_delivering')
      ))
    )
  );

-- Обновляем RPC функцию get_driver_location_for_order: убираем доступ организации ко всем водителям
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

  -- Получаем роль пользователя
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  -- Проверяем доступ
  -- 1. Водитель может видеть свое местоположение
  IF v_user_id = p_driver_id THEN
    v_has_access := TRUE;
  END IF;

  -- 2. Клиент/Организация может видеть местоположение водителя для своего активного заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering', 'completed')
    ) INTO v_has_access;
  END IF;

  -- 3. Клиент/Организация может видеть местоположение водителя для любого своего активного заказа
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering')
    ) INTO v_has_access;
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
      SELECT current_location::TEXT INTO v_location_text
      FROM public.profiles
      WHERE id = p_driver_id
        AND current_location IS NOT NULL;
      
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
          RETURN QUERY
          SELECT
            v_lat as latitude,
            v_lon as longitude,
            NULL::DECIMAL as accuracy,
            NULL::DECIMAL as heading,
            NULL::DECIMAL as speed,
            (SELECT location_updated_at FROM public.profiles WHERE id = p_driver_id) as updated_at,
            'profiles'::TEXT as source;
        END IF;
      END IF;
    END;
  END IF;
END;
$$;

-- Обновляем RPC функцию get_driver_profile_for_client: убираем доступ организации ко всем водителям
CREATE OR REPLACE FUNCTION public.get_driver_profile_for_client(
  p_driver_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  avatar_url TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  current_location POINT,
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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

  -- Получаем роль пользователя
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  -- Проверяем доступ
  -- 1. Водитель может видеть свой профиль
  IF v_user_id = p_driver_id THEN
    v_has_access := TRUE;
  END IF;

  -- 2. Клиент/Организация может видеть профиль водителя для своего активного заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering', 'completed')
    ) INTO v_has_access;
  END IF;

  -- 3. Клиент/Организация может видеть профиль водителя для любого своего активного заказа
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering')
    ) INTO v_has_access;
  END IF;

  -- 4. Суперадмин может видеть все
  IF NOT v_has_access AND v_user_role = 'superadmin' THEN
    v_has_access := TRUE;
  END IF;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  -- Возвращаем профиль водителя
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.role,
    p.avatar_url,
    p.vehicle_type,
    p.vehicle_number,
    p.license_number,
    p.current_location,
    p.location_updated_at,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = p_driver_id;
END;
$$;

-- Создаем новую RPC функцию для получения водителей организации с активными заказами (для страницы tracking)
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
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.vehicle_type,
    p.vehicle_number,
    p.license_number,
    -- Возвращаем current_location только если есть активный заказ
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.executor_user_id = p.id
          AND o.customer_id = organization_user_id
          AND o.status IN ('courier_coming', 'courier_delivering')
      ) THEN p.current_location
      ELSE NULL
    END as current_location,
    -- Возвращаем location_updated_at только если есть активный заказ
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.executor_user_id = p.id
          AND o.customer_id = organization_user_id
          AND o.status IN ('courier_coming', 'courier_delivering')
      ) THEN p.location_updated_at
      ELSE NULL
    END as location_updated_at,
    p.avatar_url,
    p.created_at,
    o.id as active_order_id,
    o.status as active_order_status
  FROM public.profiles p
  LEFT JOIN public.orders o ON o.executor_user_id = p.id
    AND o.customer_id = organization_user_id
    AND o.status IN ('courier_coming', 'courier_delivering')
  WHERE p.organization_id = organization_user_id
    AND p.role = 'driver'
    AND o.id IS NOT NULL  -- Только водители с активными заказами
  ORDER BY p.created_at DESC;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_organization_drivers_with_active_orders(UUID) TO authenticated;

-- Комментарии
COMMENT ON POLICY "Organizations can view their drivers location for active orders" ON public.profiles IS 
  'Организация может видеть current_location своих водителей только если у них есть активный заказ';

COMMENT ON POLICY "Organizations can view their drivers locations for active orders" ON public.driver_locations IS 
  'Организация может видеть местоположение своих водителей только для активных заказов';

COMMENT ON FUNCTION public.get_organization_drivers_with_active_orders(UUID) IS 
  'Возвращает водителей организации только с активными заказами, включая их местоположение';

