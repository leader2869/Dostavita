-- Миграция 079: Добавление поля paid_by (кто оплачивает заказ) в таблицу orders
-- Поле указывает, кто оплачивает заказ: отправитель (sender) или получатель (recipient)
-- По умолчанию: отправитель (sender)

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS paid_by TEXT DEFAULT 'sender' CHECK (paid_by IN ('sender', 'recipient'));

COMMENT ON COLUMN public.orders.paid_by IS 'Кто оплачивает заказ: sender (отправитель) или recipient (получатель). По умолчанию: sender.';

-- Обновляем существующие заказы: устанавливаем 'sender' для всех существующих заказов
UPDATE public.orders
SET paid_by = 'sender'
WHERE paid_by IS NULL;

-- Делаем поле обязательным (NOT NULL)
ALTER TABLE public.orders
ALTER COLUMN paid_by SET NOT NULL;


