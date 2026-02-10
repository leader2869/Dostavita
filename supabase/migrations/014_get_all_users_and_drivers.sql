-- Миграция 014: RPC функции для получения всех пользователей и водителей (обходит RLS)
-- Эти функции позволяют админам получать списки всех пользователей и водителей

-- Функция для получения всех пользователей
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
    p.role,
    p.avatar_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

-- Функция для получения всех водителей с информацией о профилях
CREATE OR REPLACE FUNCTION public.get_all_drivers()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  vehicle_type TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  fleet_id UUID,
  is_available BOOLEAN,
  rating DECIMAL(3, 2),
  total_orders INTEGER,
  shift_status TEXT,
  shift_started_at TIMESTAMPTZ,
  shift_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  profile_email TEXT,
  profile_full_name TEXT,
  profile_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.user_id,
    d.vehicle_type,
    d.vehicle_number,
    d.license_number,
    d.fleet_id,
    d.is_available,
    d.rating,
    d.total_orders,
    d.shift_status,
    d.shift_started_at,
    d.shift_ended_at,
    d.created_at,
    p.email as profile_email,
    p.full_name as profile_full_name,
    p.phone as profile_phone
  FROM public.drivers d
  LEFT JOIN public.profiles p ON d.user_id = p.id
  ORDER BY d.created_at DESC;
END;
$$;

-- Даем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_drivers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_drivers() TO anon;

