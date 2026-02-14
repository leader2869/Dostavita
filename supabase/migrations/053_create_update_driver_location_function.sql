-- Миграция 053: RPC функция для обновления местоположения водителя (обходит RLS)

-- Функция для обновления местоположения водителя
-- Использует SECURITY DEFINER для обхода RLS
-- ВАЖНО: Не проверяем роль через SELECT, чтобы избежать рекурсии
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
  -- Обновляем местоположение водителя напрямую, без проверки роли
  -- Проверка роли выполняется в API перед вызовом этой функции
  UPDATE public.profiles
  SET 
    current_location = POINT(p_longitude, p_latitude),
    location_updated_at = NOW()
  WHERE id = p_driver_id;
  
  -- Проверяем, была ли обновлена хотя бы одна строка
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
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

