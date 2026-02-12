-- Миграция 037: RPC функция для получения информации об организации водителя

-- Функция для получения информации об организации, к которой привязан водитель
CREATE OR REPLACE FUNCTION public.get_driver_organization_info(driver_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_email TEXT,
  organization_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as organization_id,
    o.full_name as organization_name,
    o.email as organization_email,
    o.phone as organization_phone
  FROM public.profiles d
  LEFT JOIN public.profiles o ON d.organization_id = o.id
  WHERE d.id = driver_user_id
    AND d.role = 'driver'
    AND d.organization_id IS NOT NULL;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_organization_info(UUID) TO authenticated;

