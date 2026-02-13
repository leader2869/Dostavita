-- Миграция 046: Гарантированное присвоение номеров всем заказам
-- Этот скрипт убеждается, что все заказы имеют номера

-- Убеждаемся, что последовательность существует
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

-- Убеждаемся, что поле order_number существует
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Убеждаемся, что уникальный индекс существует
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number) WHERE order_number IS NOT NULL;

-- Присваиваем номера всем заказам, у которых их нет
-- Номера присваиваются по порядку создания (created_at ASC)
DO $$
DECLARE
  order_rec RECORD;
  counter INTEGER;
  max_number INTEGER;
  total_updated INTEGER := 0;
BEGIN
  -- Находим максимальный существующий номер заказа
  SELECT COALESCE(MAX(order_number), 0) INTO max_number
  FROM public.orders
  WHERE order_number IS NOT NULL;
  
  -- Начинаем счетчик с максимального номера + 1
  counter := max_number + 1;
  
  -- Присваиваем номера всем заказам без номеров в порядке создания
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
    total_updated := total_updated + 1;
  END LOOP;
  
  -- Устанавливаем значение последовательности на максимальный номер
  IF counter > max_number + 1 THEN
    -- Были присвоены новые номера
    PERFORM setval('public.order_number_seq', counter - 1, true);
    RAISE NOTICE 'Присвоено новых номеров: %', total_updated;
    RAISE NOTICE 'Максимальный номер заказа: %', counter - 1;
  ELSIF max_number > 0 THEN
    -- Номера уже были, но новых не присваивали
    PERFORM setval('public.order_number_seq', max_number, true);
    RAISE NOTICE 'Все заказы уже имеют номера. Максимальный номер: %', max_number;
  ELSE
    RAISE NOTICE 'Заказов в базе данных нет';
  END IF;
END $$;

-- Комментарий
COMMENT ON COLUMN public.orders.order_number IS 'Последовательный номер заказа для отображения пользователям';

