-- Миграция 055: Исправление бесконечной рекурсии в функциях check_user_role и is_driver_organization
-- Проблема: эти функции делают SELECT из profiles без отключения RLS,
-- что вызывает рекурсию, когда они вызываются из политик RLS для profiles

-- КРИТИЧЕСКИ ВАЖНО: Удаляем ВСЕ потенциально проблемные политики,
-- которые могут использовать рекурсивные SELECT из profiles
-- Это гарантирует, что старые версии политик не будут конфликтовать
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Organizations can view their drivers location" ON public.profiles;
DROP POLICY IF EXISTS "Organizations can view their drivers location for active orders" ON public.profiles;

-- Исправляем функцию check_user_role: отключаем RLS перед SELECT
CREATE OR REPLACE FUNCTION public.check_user_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Временно отключаем RLS для этого SELECT
  -- Это критически важно для предотвращения рекурсии
  PERFORM set_config('row_security', 'off', true);
  
  -- Получаем роль пользователя
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
  
  -- Проверяем, что роль совпадает
  RETURN v_user_role = p_role;
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RETURN FALSE;
END;
$$;

-- Исправляем функцию is_driver_organization: отключаем RLS перед SELECT
CREATE OR REPLACE FUNCTION public.is_driver_organization(p_driver_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_driver_org_id UUID;
BEGIN
  -- Временно отключаем RLS для этого SELECT
  -- Это критически важно для предотвращения рекурсии
  PERFORM set_config('row_security', 'off', true);
  
  -- Получаем organization_id водителя
  SELECT organization_id INTO v_driver_org_id
  FROM public.profiles
  WHERE id = p_driver_id
    AND role = 'driver';
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
  
  -- Проверяем, что organization_id совпадает
  RETURN v_driver_org_id = p_org_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RETURN FALSE;
END;
$$;

-- Пересоздаем политику "Organizations can view their drivers location" с использованием исправленной функции
-- ВАЖНО: Организация может видеть current_location своих водителей ВСЕГДА (без ограничения на активные заказы)
CREATE POLICY "Organizations can view their drivers location"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
    OR
    -- Организация может видеть current_location своих водителей ВСЕГДА
    -- Проверяем только, что водитель принадлежит организации и текущий пользователь - организация
    (
      profiles.organization_id = auth.uid()
      AND profiles.role = 'driver'
      AND public.check_user_role(auth.uid(), 'customer')
    )
  );

-- Создаем политику "Admins can view all profiles" с использованием исправленной функции
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
    OR
    -- Админы и суперадмины могут видеть все профили
    (
      public.check_user_role(auth.uid(), 'admin')
      OR public.check_user_role(auth.uid(), 'superadmin')
    )
  );

-- Создаем политику "Superadmins can update any profile" с использованием исправленной функции
CREATE POLICY "Superadmins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    -- Используем функцию check_user_role вместо прямого SELECT
    public.check_user_role(auth.uid(), 'superadmin')
  )
  WITH CHECK (
    -- Используем функцию check_user_role вместо прямого SELECT
    public.check_user_role(auth.uid(), 'superadmin')
  );

-- Обновляем политику для driver_locations: организация может видеть местоположение своих водителей ВСЕГДА
-- Удаляем старую политику, если она существует
DROP POLICY IF EXISTS "Organizations can view their drivers locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Organizations can view their drivers locations for active orders" ON public.driver_locations;

-- Создаем политику: организация может видеть местоположение своих водителей ВСЕГДА (без ограничения на активные заказы)
-- ВАЖНО: Используем функцию is_driver_organization для избежания рекурсии RLS
CREATE POLICY "Organizations can view their drivers locations"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (
    -- Организация может видеть местоположение своих водителей ВСЕГДА
    -- Используем функцию is_driver_organization, которая отключает RLS перед SELECT из profiles
    public.is_driver_organization(driver_locations.driver_id, auth.uid())
  );

-- Обновляем комментарии
COMMENT ON FUNCTION public.check_user_role(UUID, TEXT) IS 
  'Проверяет роль пользователя без рекурсии в RLS политиках. Отключает RLS для предотвращения бесконечной рекурсии.';

COMMENT ON FUNCTION public.is_driver_organization(UUID, UUID) IS 
  'Проверяет, является ли пользователь организацией водителя. Отключает RLS для предотвращения бесконечной рекурсии.';

COMMENT ON POLICY "Organizations can view their drivers location" ON public.profiles IS 
  'Организация может видеть current_location своих водителей в таблице profiles всегда';

COMMENT ON POLICY "Organizations can view their drivers locations" ON public.driver_locations IS 
  'Организация может видеть местоположение своих водителей в таблице driver_locations всегда';

