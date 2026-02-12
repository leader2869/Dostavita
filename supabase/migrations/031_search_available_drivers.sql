-- Миграция 031: RPC функция для поиска свободных водителей (обходит RLS)

-- Функция для поиска водителей, которые не привязаны к организации
CREATE OR REPLACE FUNCTION public.search_available_drivers(search_term TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  avatar_url TEXT,
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
    p.email,
    p.full_name,
    p.phone,
    p.vehicle_type,
    p.vehicle_number,
    p.license_number,
    p.avatar_url,
    p.organization_id
  FROM public.profiles p
  WHERE p.role = 'driver'
    AND p.organization_id IS NULL
    AND (
      search_term IS NULL OR
      search_term = '' OR
      p.email ILIKE '%' || search_term || '%' OR
      p.full_name ILIKE '%' || search_term || '%' OR
      p.phone ILIKE '%' || search_term || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT 20;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.search_available_drivers(TEXT) TO authenticated;

