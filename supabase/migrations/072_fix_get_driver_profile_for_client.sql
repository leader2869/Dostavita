-- Миграция 072: Исправление функции get_driver_profile_for_client
-- 1. Исправляет неоднозначную ссылку на колонку "role"
-- 2. Добавляет vehicle_brand и vehicle_model в возвращаемые поля

-- Удаляем старую функцию, так как меняется тип возвращаемого значения
DROP FUNCTION IF EXISTS public.get_driver_profile_for_client(UUID, UUID);

-- Создаем функцию заново с обновленными полями
CREATE FUNCTION public.get_driver_profile_for_client(
  p_driver_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  avatar_url TEXT,
  vehicle_type TEXT,
  vehicle_brand TEXT,
  vehicle_model TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  current_location POINT,
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_has_access BOOLEAN := FALSE;
BEGIN
  -- Получаем текущего пользователя
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Получаем роль пользователя
  SELECT p.role INTO v_user_role
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- Проверяем доступ
  -- 1. Водитель может видеть свой профиль
  IF v_user_id = p_driver_id THEN
    v_has_access := TRUE;
  END IF;

  -- 2. Клиент/Организация может видеть профиль водителя для своего активного заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering', 'completed')
    ) INTO v_has_access;
  END IF;

  -- 3. Клиент/Организация может видеть профиль водителя для любого своего активного заказа
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering')
    ) INTO v_has_access;
  END IF;

  -- 4. Суперадмин может видеть все
  IF NOT v_has_access AND v_user_role = 'superadmin' THEN
    v_has_access := TRUE;
  END IF;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  -- Возвращаем профиль водителя
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.role,
    p.avatar_url,
    p.vehicle_type,
    p.vehicle_brand,
    p.vehicle_model,
    p.vehicle_number,
    p.license_number,
    p.current_location,
    p.location_updated_at,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = p_driver_id;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_profile_for_client(UUID, UUID) TO authenticated;

-- Комментарий
COMMENT ON FUNCTION public.get_driver_profile_for_client(UUID, UUID) IS 'Безопасное получение профиля водителя для клиентов с проверкой доступа через заказы. Включает vehicle_brand и vehicle_model.';

