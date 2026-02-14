-- Миграция 051: Исправление рекурсии в RLS политиках для profiles

-- Проблема: политики, которые используют SELECT из profiles внутри политики для profiles,
-- создают бесконечную рекурсию. Нужно переписать их без рекурсии.

-- Удаляем проблемные политики
DROP POLICY IF EXISTS "Organizations can view their drivers location" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Создаем функцию для проверки роли пользователя (без рекурсии)
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
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN v_user_role = p_role;
END;
$$;

-- Создаем функцию для проверки, является ли пользователь организацией водителя
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
  SELECT organization_id INTO v_driver_org_id
  FROM public.profiles
  WHERE id = p_driver_id
    AND role = 'driver';
  
  RETURN v_driver_org_id = p_org_id;
END;
$$;

-- Политика для организаций: могут видеть профили своих водителей
-- Используем функцию для избежания рекурсии
CREATE POLICY "Organizations can view their drivers location"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
    OR
    -- Организация может видеть профили своих водителей
    (
      profiles.organization_id = auth.uid()
      AND profiles.role = 'driver'
      AND public.check_user_role(auth.uid(), 'customer')
    )
  );

-- Политика для админов: могут видеть все профили
-- Используем функцию для избежания рекурсии
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

-- Даем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.check_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_organization(UUID, UUID) TO authenticated;

-- Комментарии
COMMENT ON FUNCTION public.check_user_role(UUID, TEXT) IS 'Проверяет роль пользователя без рекурсии в RLS политиках';
COMMENT ON FUNCTION public.is_driver_organization(UUID, UUID) IS 'Проверяет, является ли пользователь организацией водителя';

