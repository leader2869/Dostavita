-- Миграция 048: Исправление доступа к местоположению водителя для клиентов и организаций

-- Политика "Clients can view driver profiles for their orders" уже существует в миграции 026
-- Она позволяет клиентам видеть профили водителей, включая current_location
-- Поэтому не нужно создавать отдельную политику для current_location

-- Добавляем политику для profiles: организации могут видеть current_location своих водителей
CREATE POLICY "Organizations can view their drivers location"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Организация может видеть current_location своих водителей
    EXISTS (
      SELECT 1 FROM public.profiles org
      WHERE org.id = auth.uid()
        AND org.role = 'customer'
        AND profiles.organization_id = org.id
        AND profiles.role = 'driver'
    )
    OR
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
  );

-- Улучшаем политику для driver_locations: клиенты могут видеть местоположение водителя для своих заказов
-- (даже если order_id не указан, но водитель выполняет заказ клиента)
DROP POLICY IF EXISTS "Clients can view driver location for their orders" ON public.driver_locations;
CREATE POLICY "Clients can view driver location for their orders"
  ON public.driver_locations FOR SELECT
  USING (
    -- Если есть order_id, проверяем через заказ
    (order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = driver_locations.order_id
        AND (orders.client_id = auth.uid() OR orders.customer_id = auth.uid())
    ))
    OR
    -- Если order_id нет, проверяем через заказы водителя
    (order_id IS NULL AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.executor_user_id = driver_locations.driver_id
        AND (orders.client_id = auth.uid() OR orders.customer_id = auth.uid())
        AND orders.status IN ('courier_coming', 'courier_delivering')
    ))
  );

-- Улучшаем политику для driver_locations: организации могут видеть местоположение своих водителей
DROP POLICY IF EXISTS "Organizations can view their drivers locations" ON public.driver_locations;
CREATE POLICY "Organizations can view their drivers locations"
  ON public.driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = driver_locations.driver_id
        AND profiles.organization_id = auth.uid()
        AND profiles.role = 'driver'
    )
  );

-- Создаем RPC функцию для получения местоположения водителя (обходит RLS для безопасного доступа)
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

  -- 2. Клиент может видеть местоположение водителя для своего заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
    ) INTO v_has_access;
  END IF;

  -- 3. Организация может видеть местоположение своих водителей
  IF NOT v_has_access AND v_user_role = 'customer' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_driver_id
        AND organization_id = v_user_id
        AND role = 'driver'
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
  -- Используем простой парсинг строки POINT, так как PostGIS может быть не доступен
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

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_location_for_order(UUID, UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.get_driver_location_for_order(UUID, UUID) IS 'Безопасное получение местоположения водителя для клиентов и организаций';

