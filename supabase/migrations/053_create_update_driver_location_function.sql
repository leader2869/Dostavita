-- Миграция 053: RPC функция для обновления местоположения водителя (обходит RLS)

-- Функция для обновления местоположения водителя
CREATE OR REPLACE FUNCTION public.update_driver_location(
  p_driver_id UUID,
  p_longitude DECIMAL,
  p_latitude DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Проверяем, что пользователь существует и является водителем
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_driver_id;

  IF NOT FOUND OR v_role != 'driver' THEN
    RETURN FALSE;
  END IF;

  -- Обновляем местоположение водителя
  UPDATE public.profiles
  SET 
    current_location = POINT(p_longitude, p_latitude),
    location_updated_at = NOW()
  WHERE id = p_driver_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Ошибка обновления местоположения водителя: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.update_driver_location(UUID, DECIMAL, DECIMAL) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.update_driver_location(UUID, DECIMAL, DECIMAL) IS 
  'Обновляет местоположение водителя в таблице profiles. Обходит RLS через SECURITY DEFINER. Проверяет, что пользователь является водителем.';

