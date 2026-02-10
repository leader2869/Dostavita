-- Миграция 003: Функции для работы с заказами

-- Функция для принятия заказа водителем
CREATE OR REPLACE FUNCTION public.accept_order(order_uuid UUID, driver_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  driver_record RECORD;
BEGIN
  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'searching_courier' AND visibility = 'public';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем водителя
  SELECT * INTO driver_record
  FROM public.drivers
  WHERE id = driver_uuid AND is_available = true AND shift_status = 'online';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем заказ
  UPDATE public.orders
  SET 
    driver_id = driver_uuid,
    executor_user_id = driver_record.user_id,
    status = 'courier_coming',
    accepted_at = NOW()
  WHERE id = order_uuid;
  
  -- Делаем водителя недоступным
  UPDATE public.drivers
  SET is_available = false
  WHERE id = driver_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для отметки "забрал заказ" (переход в статус "курьер доставляет")
CREATE OR REPLACE FUNCTION public.pickup_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
BEGIN
  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_coming';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Обновляем заказ
  UPDATE public.orders
  SET 
    status = 'courier_delivering',
    picked_up_at = NOW(),
    started_delivery_at = NOW()
  WHERE id = order_uuid;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для завершения заказа и начисления средств
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
    'Начисление за выполнение заказа #' || order_uuid::TEXT
  );
  
  -- Делаем водителя снова доступным
  UPDATE public.drivers
  SET 
    is_available = true,
    total_orders = total_orders + 1
  WHERE user_id = driver_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

