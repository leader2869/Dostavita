-- Миграция 042: Исправление уникального ограничения для driver_organization_requests
-- Проблема: уникальное ограничение включало status, что не позволяло обновлять статус запроса
-- Решение: использовать частичный уникальный индекс только для pending запросов

-- Удаляем старое уникальное ограничение
ALTER TABLE public.driver_organization_requests 
DROP CONSTRAINT IF EXISTS driver_organization_requests_driver_user_id_organization_us_key;

-- Создаем частичный уникальный индекс только для pending запросов
-- Это позволяет иметь только один активный (pending) запрос на пару водитель-организация
-- Но разрешает несколько записей с разными статусами (accepted, rejected, cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS driver_organization_requests_unique_pending
ON public.driver_organization_requests(driver_user_id, organization_user_id)
WHERE status = 'pending';

-- Комментарий
COMMENT ON INDEX driver_organization_requests_unique_pending IS 
'Уникальный индекс для pending запросов. Разрешает только один активный запрос на пару водитель-организация, но позволяет несколько записей с разными статусами.';

