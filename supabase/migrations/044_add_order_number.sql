-- Миграция 044: Добавление последовательной нумерации заказов

-- Создаем последовательность для номеров заказов
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

-- Добавляем поле order_number в таблицу orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Создаем уникальный индекс для order_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number) WHERE order_number IS NOT NULL;

-- Функция для автоматического присвоения номера заказа
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Если order_number не задан, присваиваем следующий номер из последовательности
  IF NEW.order_number IS NULL THEN
    NEW.order_number := nextval('public.order_number_seq');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггер для автоматического присвоения номера при создании заказа
DROP TRIGGER IF EXISTS trigger_assign_order_number ON public.orders;
CREATE TRIGGER trigger_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_number();

-- Обновляем существующие заказы: присваиваем им номера на основе created_at
-- Это нужно для того, чтобы существующие заказы тоже имели номера
DO $$
DECLARE
  order_rec RECORD;
  counter INTEGER;
  max_number INTEGER;
BEGIN
  -- Находим максимальный существующий номер заказа (если есть)
  SELECT COALESCE(MAX(order_number), 0) INTO max_number
  FROM public.orders
  WHERE order_number IS NOT NULL;
  
  -- Начинаем счетчик с максимального номера + 1
  -- Если номеров нет, начинаем с 1
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
  -- Это гарантирует, что новые заказы получат номера, начиная с максимального + 1
  IF counter > max_number + 1 THEN
    -- Были присвоены новые номера
    PERFORM setval('public.order_number_seq', counter - 1, true);
  ELSIF max_number > 0 THEN
    -- Номера уже были, но новых не присваивали
    PERFORM setval('public.order_number_seq', max_number, true);
  END IF;
  
  RAISE NOTICE 'Присвоено номеров существующим заказам: %', GREATEST(0, counter - max_number - 1);
END $$;

-- Комментарии
COMMENT ON COLUMN public.orders.order_number IS 'Последовательный номер заказа для отображения пользователям';
COMMENT ON SEQUENCE public.order_number_seq IS 'Последовательность для генерации номеров заказов';

