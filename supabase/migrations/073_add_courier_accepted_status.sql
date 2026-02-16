-- Миграция 073: Добавление нового статуса courier_accepted и обновление функций

-- 1. Обновляем функцию accept_order - теперь устанавливает courier_accepted вместо courier_coming
DROP FUNCTION IF EXISTS public.accept_order(UUID, UUID);

CREATE OR REPLACE FUNCTION public.accept_order(order_uuid UUID, driver_user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  driver_profile RECORD;
BEGIN
  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'searching_courier';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем профиль водителя и проверяем наличие информации об автомобиле
  SELECT * INTO driver_profile
  FROM public.profiles
  WHERE id = driver_user_uuid 
    AND role = 'driver'
    AND vehicle_type IS NOT NULL
    AND license_number IS NOT NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем заказ - устанавливаем новый статус courier_accepted
  UPDATE public.orders
  SET 
    executor_user_id = driver_user_uuid,
    status = 'courier_accepted',
    accepted_at = NOW()
  WHERE id = order_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Создаем новую функцию для перехода из courier_accepted в courier_coming
CREATE OR REPLACE FUNCTION public.start_coming_to_pickup(order_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
BEGIN
  -- Получаем заказ со статусом courier_accepted
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_accepted';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем заказ - переводим в статус courier_coming
  UPDATE public.orders
  SET 
    status = 'courier_coming'
  WHERE id = order_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Даем права на выполнение новой функции
GRANT EXECUTE ON FUNCTION public.start_coming_to_pickup(UUID) TO authenticated;

-- Комментарии
COMMENT ON FUNCTION public.accept_order(UUID, UUID) IS 'Принимает заказ водителем. Устанавливает статус courier_accepted.';
COMMENT ON FUNCTION public.start_coming_to_pickup(UUID) IS 'Переводит заказ из статуса courier_accepted в courier_coming (водитель начинает движение к отправителю).';

