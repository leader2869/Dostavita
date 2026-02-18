-- Миграция 022: RPC функция для получения настроек доставки (обходит RLS)

CREATE OR REPLACE FUNCTION public.get_delivery_settings()
RETURNS TABLE (
  id UUID,
  setting_key TEXT,
  setting_value INTEGER,
  description TEXT,
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
    ds.id,
    ds.setting_key,
    ds.setting_value,
    ds.description,
    ds.created_at,
    ds.updated_at
  FROM public.delivery_settings ds
  ORDER BY ds.setting_key;
END;
$$;

-- Даем права на выполнение функции всем аутентифицированным пользователям
GRANT EXECUTE ON FUNCTION public.get_delivery_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_settings() TO anon;




