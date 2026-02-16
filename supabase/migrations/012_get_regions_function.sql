-- Миграция 012: RPC функция для получения регионов (обходит RLS)
-- Эта функция позволяет получить все регионы, обходя RLS политики

CREATE OR REPLACE FUNCTION public.get_all_regions()
RETURNS TABLE (
  id UUID,
  name TEXT,
  base_price DECIMAL(10, 2),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.base_price,
    r.is_active,
    r.created_at
  FROM public.regions r
  ORDER BY r.name;
END;
$$;

-- Даем права на выполнение функции всем аутентифицированным пользователям
GRANT EXECUTE ON FUNCTION public.get_all_regions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_regions() TO anon;



