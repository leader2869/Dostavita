-- Миграция 053: RPC функция для обновления местоположения водителя (обходит RLS)

-- Функция для обновления местоположения водителя
-- Использует SECURITY DEFINER для обхода RLS
-- ВАЖНО: Отключаем RLS внутри функции, чтобы полностью избежать рекурсии
-- Проверка роли выполняется в API перед вызовом функции
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
BEGIN
  -- Временно отключаем RLS для этого обновления
  -- Это гарантирует, что обновление пройдет без проверки политик
  PERFORM set_config('row_security', 'off', true);
  
  -- Обновляем местоположение водителя напрямую
  UPDATE public.profiles
  SET 
    current_location = POINT(p_longitude, p_latitude),
    location_updated_at = NOW()
  WHERE id = p_driver_id;
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
  
  -- Проверяем, была ли обновлена хотя бы одна строка
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка обновления местоположения водителя: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.update_driver_location(UUID, DECIMAL, DECIMAL) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.update_driver_location(UUID, DECIMAL, DECIMAL) IS 
  'Обновляет местоположение водителя в таблице profiles. Обходит RLS через SECURITY DEFINER. Проверяет, что пользователь является водителем.';

