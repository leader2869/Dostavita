-- Миграция 070: Добавление обязательного поля номера получателя в заказы

-- Добавляем колонку с номером получателя
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT NOT NULL DEFAULT '';

-- Удаляем значение по умолчанию после добавления колонки (чтобы поле было обязательным для новых заказов)
-- Для существующих заказов установим пустую строку, но новые заказы должны иметь номер
ALTER TABLE public.orders
  ALTER COLUMN recipient_phone DROP DEFAULT;

-- Комментарий к полю
COMMENT ON COLUMN public.orders.recipient_phone IS 'Номер телефона получателя заказа (обязательное поле)';

