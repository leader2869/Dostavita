-- Миграция 057: Создание функции для получения трека водителя за день
-- Трек - это история движения водителя, сохраненная в таблице driver_locations

-- Функция для получения трека водителя за указанный день
CREATE OR REPLACE FUNCTION public.get_driver_track(
  p_driver_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id UUID,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(8, 2),
  heading DECIMAL(5, 2),
  speed DECIMAL(6, 2),
  created_at TIMESTAMPTZ,
  order_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Отключаем RLS для чтения из driver_locations
  PERFORM set_config('row_security', 'off', true);
  
  RETURN QUERY
  SELECT
    dl.id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.created_at,
    dl.order_id
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND DATE(dl.created_at) = p_date
  ORDER BY dl.created_at ASC;
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_track: %', SQLERRM;
    RETURN;
END;
$$;

-- Функция для получения трека водителя за период
CREATE OR REPLACE FUNCTION public.get_driver_track_period(
  p_driver_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(8, 2),
  heading DECIMAL(5, 2),
  speed DECIMAL(6, 2),
  created_at TIMESTAMPTZ,
  order_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Отключаем RLS для чтения из driver_locations
  PERFORM set_config('row_security', 'off', true);
  
  RETURN QUERY
  SELECT
    dl.id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.created_at,
    dl.order_id
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND dl.created_at >= p_start_date
    AND dl.created_at <= p_end_date
  ORDER BY dl.created_at ASC;
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_track_period: %', SQLERRM;
    RETURN;
END;
$$;

-- Даем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.get_driver_track(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_track_period(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Комментарии
COMMENT ON FUNCTION public.get_driver_track(UUID, DATE) IS 
  'Возвращает трек (историю местоположений) водителя за указанный день. Организация может видеть трек своих водителей.';

COMMENT ON FUNCTION public.get_driver_track_period(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 
  'Возвращает трек (историю местоположений) водителя за указанный период времени. Организация может видеть трек своих водителей.';

