-- Миграция 070: Добавление поля номера получателя в заказы

-- Добавляем колонку с номером получателя (необязательное поле)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

-- Комментарий к полю
COMMENT ON COLUMN public.orders.recipient_phone IS 'Номер телефона получателя заказа (необязательное поле)';

