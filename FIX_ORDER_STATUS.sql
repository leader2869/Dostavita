-- Скрипт для исправления статуса заказа
-- Обновляет статус заказов, где executor_user_id установлен, но статус остался searching_courier

-- Обновляем заказы, где executor_user_id установлен, но статус остался searching_courier
UPDATE public.orders
SET status = 'courier_coming'
WHERE executor_user_id IS NOT NULL
  AND status = 'searching_courier'
  AND accepted_at IS NOT NULL;

-- Проверяем результат
SELECT 
  id,
  executor_user_id,
  status,
  accepted_at,
  created_at
FROM public.orders
WHERE executor_user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;



