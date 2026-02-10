-- Миграция 013: RPC функция для получения статистики админа (обходит RLS)
-- Эта функция позволяет получить статистику (количество пользователей, водителей, заказов)

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  users_count BIGINT,
  drivers_count BIGINT,
  orders_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.profiles)::BIGINT as users_count,
    (SELECT COUNT(*) FROM public.drivers)::BIGINT as drivers_count,
    (SELECT COUNT(*) FROM public.orders)::BIGINT as orders_count;
END;
$$;

-- Даем права на выполнение функции всем аутентифицированным пользователям
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO anon;

