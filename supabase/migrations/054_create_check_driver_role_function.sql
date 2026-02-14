-- Миграция 054: Простая функция для проверки роли водителя без рекурсии
-- Использует только auth.uid() и не делает SELECT из profiles в политиках

CREATE OR REPLACE FUNCTION public.check_driver_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Временно отключаем RLS для этого SELECT
  PERFORM set_config('row_security', 'off', true);
  
  -- Получаем роль пользователя
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
  
  -- Проверяем, что роль - водитель
  RETURN v_role = 'driver';
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RETURN FALSE;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.check_driver_role(UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.check_driver_role(UUID) IS 
  'Проверяет, является ли пользователь водителем. Отключает RLS для предотвращения рекурсии.';

