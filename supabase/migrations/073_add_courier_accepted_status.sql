-- Миграция 073: Добавление нового статуса courier_accepted и обновление функций

-- 0. Обновляем CHECK constraint для поля status в таблице orders
-- Сначала удаляем старый constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Создаем новый constraint с добавленным статусом courier_accepted
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'searching_courier',    -- Ищем курьера
  'courier_accepted',     -- Курьер принял заказ (НОВЫЙ)
  'courier_coming',       -- Курьер едет к отправителю
  'courier_delivering',   -- Курьер едет к получателю
  'completed',            -- Заказ завершен
  'cancelled'             -- Отменен
));

-- 0.1. Добавляем поле для времени начала движения к отправителю
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS started_coming_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.started_coming_at IS 'Время начала движения водителя к отправителю (переход в статус courier_coming)';

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
  
  -- Обновляем заказ - переводим в статус courier_coming и устанавливаем время начала движения
  UPDATE public.orders
  SET 
    status = 'courier_coming',
    started_coming_at = NOW()
  WHERE id = order_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Даем права на выполнение новой функции
GRANT EXECUTE ON FUNCTION public.start_coming_to_pickup(UUID) TO authenticated;

-- Комментарии
COMMENT ON FUNCTION public.accept_order(UUID, UUID) IS 'Принимает заказ водителем. Устанавливает статус courier_accepted.';
COMMENT ON FUNCTION public.start_coming_to_pickup(UUID) IS 'Переводит заказ из статуса courier_accepted в courier_coming (водитель начинает движение к отправителю).';

