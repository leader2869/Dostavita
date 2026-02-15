-- Миграция 063: Исправление рекурсии RLS в политике driver_locations
-- Проблема: политика "Organizations can view their drivers locations" использует прямой SELECT из profiles,
-- что вызывает рекурсию, когда политики на profiles проверяют доступ

-- Удаляем старую политику
DROP POLICY IF EXISTS "Organizations can view their drivers locations" ON public.driver_locations;

-- Создаем политику с использованием функции is_driver_organization для избежания рекурсии
CREATE POLICY "Organizations can view their drivers locations"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (
    -- Организация может видеть местоположение своих водителей ВСЕГДА
    -- Используем функцию is_driver_organization, которая отключает RLS перед SELECT из profiles
    public.is_driver_organization(driver_locations.driver_id, auth.uid())
  );

COMMENT ON POLICY "Organizations can view their drivers locations" ON public.driver_locations IS 
  'Позволяет организациям видеть местоположение своих водителей. Использует is_driver_organization для избежания рекурсии RLS.';

