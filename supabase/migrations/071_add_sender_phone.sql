-- Миграция 071: Добавление поля номера отправителя в заказы

-- Добавляем колонку с номером отправителя (обязательное поле)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sender_phone TEXT NOT NULL DEFAULT '';

-- Комментарий к полю
COMMENT ON COLUMN public.orders.sender_phone IS 'Номер телефона отправителя заказа (обязательное поле)';

