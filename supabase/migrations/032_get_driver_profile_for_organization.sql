-- Миграция 032: RPC функция для получения профиля водителя организацией (обходит RLS)

-- Функция для получения профиля водителя (для проверки перед привязкой)
CREATE OR REPLACE FUNCTION public.get_driver_profile_for_organization(driver_user_id UUID)
RETURNS TABLE (
  id UUID,
  role TEXT,
  organization_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.role,
    p.organization_id
  FROM public.profiles p
  WHERE p.id = driver_user_id
    AND p.role = 'driver';
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_profile_for_organization(UUID) TO authenticated;

