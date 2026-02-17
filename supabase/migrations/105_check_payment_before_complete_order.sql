-- Миграция 105: Проверка оплаты перед завершением заказа
-- При закрытии заказа проверяется статус is_paid и наличие записи в receivables
-- Нельзя завершить заказ, пока либо не поступит оплата (is_paid = true), либо не создастся запись в receivables

-- Обновляем функцию complete_order для проверки оплаты
DROP FUNCTION IF EXISTS public.complete_order(UUID);

CREATE OR REPLACE FUNCTION public.complete_order(order_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_record RECORD;
  driver_user_id UUID;
  existing_receivable_id UUID;
  result JSONB;
BEGIN
  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_delivering';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Заказ не найден или не в статусе "доставляет"'
    );
  END IF;
  
  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;
  
  IF driver_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Водитель не назначен на заказ'
    );
  END IF;
  
  -- Проверяем статус оплаты
  -- Если is_paid = false или NULL, проверяем наличие записи в receivables
  IF order_record.is_paid = false OR order_record.is_paid IS NULL THEN
    -- Проверяем, есть ли запись в receivables
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;
    
    -- Если нет записи в receivables, возвращаем ошибку с требованием обработки оплаты
    IF existing_receivable_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'payment_required',
        'message', 'Необходимо обработать оплату перед завершением заказа'
      );
    END IF;
  END IF;
  
  -- Если оплата обработана (is_paid = true) или есть запись в receivables, завершаем заказ
  UPDATE public.orders
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = order_uuid;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Заказ успешно завершен'
  );
END;
$$;

COMMENT ON FUNCTION public.complete_order(UUID) IS 
  'Завершает заказ только если оплата обработана (is_paid = true) или создана запись в receivables. Возвращает JSONB с результатом операции.';

GRANT EXECUTE ON FUNCTION public.complete_order(UUID) TO authenticated;

