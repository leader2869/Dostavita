-- Миграция 071: Добавление поля номера отправителя в заказы

-- Добавляем колонку с номером отправителя (сначала nullable для существующих записей)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- Обновляем существующие записи: берем телефон из профиля отправителя
UPDATE public.orders o
SET sender_phone = p.phone
FROM public.profiles p
WHERE o.customer_id = p.id
  AND o.sender_phone IS NULL
  AND p.phone IS NOT NULL;

-- Если телефон не найден, используем пустую строку (для старых записей)
UPDATE public.orders
SET sender_phone = ''
WHERE sender_phone IS NULL;

-- Теперь делаем поле обязательным
ALTER TABLE public.orders
  ALTER COLUMN sender_phone SET NOT NULL,
  ALTER COLUMN sender_phone SET DEFAULT '';

-- Комментарий к полю
COMMENT ON COLUMN public.orders.sender_phone IS 'Номер телефона отправителя заказа (обязательное поле)';

