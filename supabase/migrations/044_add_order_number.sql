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
  counter INTEGER := 1;
BEGIN
  -- Присваиваем номера существующим заказам в порядке создания
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
  
  -- Устанавливаем значение последовательности на максимальный номер + 1
  IF counter > 1 THEN
    PERFORM setval('public.order_number_seq', counter - 1, true);
  END IF;
END $$;

-- Комментарии
COMMENT ON COLUMN public.orders.order_number IS 'Последовательный номер заказа для отображения пользователям';
COMMENT ON SEQUENCE public.order_number_seq IS 'Последовательность для генерации номеров заказов';

