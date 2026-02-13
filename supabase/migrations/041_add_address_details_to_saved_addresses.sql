-- Миграция 041: Добавление полей для подъезда, этажа и номера квартиры в saved_addresses

ALTER TABLE public.saved_addresses
ADD COLUMN IF NOT EXISTS entrance TEXT,
ADD COLUMN IF NOT EXISTS floor TEXT,
ADD COLUMN IF NOT EXISTS apartment TEXT;

-- Комментарии для документации
COMMENT ON COLUMN public.saved_addresses.entrance IS 'Подъезд';
COMMENT ON COLUMN public.saved_addresses.floor IS 'Этаж';
COMMENT ON COLUMN public.saved_addresses.apartment IS 'Номер квартиры';

-- Обновляем RPC функцию для получения сохраненных адресов
CREATE OR REPLACE FUNCTION public.get_user_saved_addresses(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  address_type TEXT,
  label TEXT,
  address TEXT,
  coordinates TEXT, -- Возвращаем как текст для удобства парсинга в приложении
  region_id UUID,
  region_name TEXT,
  entrance TEXT,
  floor TEXT,
  apartment TEXT,
  is_default BOOLEAN,
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
    sa.id,
    sa.address_type,
    sa.label,
    sa.address,
    ST_AsText(sa.coordinates) AS coordinates, -- Преобразуем GEOGRAPHY в WKT текст
    sa.region_id,
    r.name AS region_name,
    sa.entrance,
    sa.floor,
    sa.apartment,
    sa.is_default,
    sa.created_at,
    sa.updated_at
  FROM public.saved_addresses sa
  LEFT JOIN public.regions r ON sa.region_id = r.id
  WHERE sa.user_id = user_uuid
  ORDER BY sa.is_default DESC, sa.label ASC;
END;
$$;

