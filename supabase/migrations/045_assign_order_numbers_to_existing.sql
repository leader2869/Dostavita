-- Миграция 045: Присвоение номеров существующим заказам (если они еще не присвоены)
-- Этот скрипт можно выполнить отдельно, если нужно переприсвоить номера

-- Убеждаемся, что последовательность существует
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

-- Убеждаемся, что поле order_number существует
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Присваиваем номера существующим заказам, у которых еще нет номера
-- Номера присваиваются по порядку создания (created_at ASC)
DO $$
DECLARE
  order_rec RECORD;
  counter INTEGER;
  max_number INTEGER;
BEGIN
  -- Находим максимальный существующий номер заказа
  SELECT COALESCE(MAX(order_number), 0) INTO max_number
  FROM public.orders
  WHERE order_number IS NOT NULL;
  
  -- Начинаем счетчик с максимального номера + 1
  counter := max_number + 1;
  
  -- Присваиваем номера существующим заказам без номеров в порядке создания
  FOR order_rec IN 
    SELECT id 
    FROM public.orders 
    WHERE order_number IS NULL 
    ORDER BY created_at ASC
  LOOP
    UPDATE public.orders
    SET order_number = counter
    WHERE id = order_rec.id;
    
    counter := counter + 1;
  END LOOP;
  
  -- Устанавливаем значение последовательности на максимальный номер
  IF counter > max_number + 1 THEN
    PERFORM setval('public.order_number_seq', counter - 1, true);
  ELSIF max_number > 0 THEN
    PERFORM setval('public.order_number_seq', max_number, true);
  END IF;
  
  RAISE NOTICE 'Присвоено номеров заказам: %', counter - max_number - 1;
END $$;

-- Комментарий
COMMENT ON COLUMN public.orders.order_number IS 'Последовательный номер заказа для отображения пользователям';

