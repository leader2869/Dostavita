-- Миграция 025: Обновление функции accept_order для работы с profiles вместо drivers

-- Удаляем старую функцию
DROP FUNCTION IF EXISTS public.accept_order(UUID, UUID);

-- Создаем новую функцию с обновленными параметрами
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
  
  -- Обновляем заказ
  UPDATE public.orders
  SET 
    executor_user_id = driver_user_uuid,
    status = 'courier_coming',
    accepted_at = NOW()
  WHERE id = order_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Обновляем функцию complete_order, чтобы она не использовала drivers
CREATE OR REPLACE FUNCTION public.complete_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  driver_user_id UUID;
BEGIN
  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_delivering';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем заказ
  UPDATE public.orders
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = order_uuid;
  
  -- Начисляем средства водителю
  UPDATE public.balances
  SET 
    amount = amount + order_record.final_price,
    updated_at = NOW()
  WHERE user_id = driver_user_id;
  
  -- Создаем транзакцию
  INSERT INTO public.transactions (user_id, order_id, amount, type, description)
  VALUES (
    driver_user_id,
    order_uuid,
    order_record.final_price,
    'credit',
    'Начисление за выполнение Заказа №' || order_uuid::TEXT
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

