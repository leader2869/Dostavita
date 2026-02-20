-- Миграция 040: Добавление полей для подъезда, этажа и номера квартиры

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pickup_entrance TEXT,
ADD COLUMN IF NOT EXISTS pickup_floor TEXT,
ADD COLUMN IF NOT EXISTS pickup_apartment TEXT,
ADD COLUMN IF NOT EXISTS delivery_entrance TEXT,
ADD COLUMN IF NOT EXISTS delivery_floor TEXT,
ADD COLUMN IF NOT EXISTS delivery_apartment TEXT;

-- Комментарии для документации
COMMENT ON COLUMN public.orders.pickup_entrance IS 'Подъезд адреса отправления';
COMMENT ON COLUMN public.orders.pickup_floor IS 'Этаж адреса отправления';
COMMENT ON COLUMN public.orders.pickup_apartment IS 'Номер квартиры адреса отправления';
COMMENT ON COLUMN public.orders.delivery_entrance IS 'Подъезд адреса доставки';
COMMENT ON COLUMN public.orders.delivery_floor IS 'Этаж адреса доставки';
COMMENT ON COLUMN public.orders.delivery_apartment IS 'Номер квартиры адреса доставки';






