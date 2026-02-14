-- Миграция 058: Автоматическая очистка старых записей трека (старше 7 дней)
-- Трек сохраняется на неделю, потом автоматически удаляется

-- Создаем функцию для очистки старых записей трека
CREATE OR REPLACE FUNCTION public.cleanup_old_driver_tracks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Удаляем записи старше 7 дней
  DELETE FROM public.driver_locations
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Ошибка при очистке старых записей трека: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Создаем расширение pg_cron, если его нет (для автоматического запуска)
-- Примечание: pg_cron может быть недоступен в Supabase, поэтому используем альтернативный подход

-- Создаем функцию для получения трека водителя за день с фильтрацией по времени
CREATE OR REPLACE FUNCTION public.get_driver_track_with_time(
  p_driver_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL
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
    AND (p_start_time IS NULL OR TIME(dl.created_at) >= p_start_time)
    AND (p_end_time IS NULL OR TIME(dl.created_at) <= p_end_time)
  ORDER BY dl.created_at ASC;
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_track_with_time: %', SQLERRM;
    RETURN;
END;
$$;

-- Даем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.cleanup_old_driver_tracks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_track_with_time(UUID, DATE, TIME, TIME) TO authenticated;

-- Комментарии
COMMENT ON FUNCTION public.cleanup_old_driver_tracks() IS 
  'Удаляет записи трека водителей старше 7 дней. Должна вызываться периодически (например, через cron или scheduled task).';

COMMENT ON FUNCTION public.get_driver_track_with_time(UUID, DATE, TIME, TIME) IS 
  'Возвращает трек водителя за указанный день с возможностью фильтрации по времени. Используется для отображения позиции водителя в конкретное время.';

-- Примечание: Для автоматической очистки в Supabase можно использовать:
-- 1. Edge Functions с расписанием (если доступно)
-- 2. Внешний cron job, который вызывает функцию через API
-- 3. Или выполнять cleanup_old_driver_tracks() вручную периодически

