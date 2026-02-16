-- Тест функции accept_order
-- Замените ORDER_ID на реальный ID заказа со статусом searching_courier

-- 1. Проверяем заказ перед принятием
SELECT 
  id,
  status,
  executor_user_id,
  driver_id,
  created_at
FROM public.orders
WHERE status = 'searching_courier'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Проверяем профиль водителя
SELECT 
  id,
  email,
  role,
  vehicle_type,
  license_number
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 3. Тестируем функцию accept_order (замените ORDER_ID на реальный ID)
-- SELECT public.accept_order('ORDER_ID_HERE'::uuid, '3efb4975-5bfd-4151-920e-2ce5508f0729'::uuid);

-- 4. Проверяем результат после принятия
-- SELECT 
--   id,
--   status,
--   executor_user_id,
--   accepted_at
-- FROM public.orders
-- WHERE id = 'ORDER_ID_HERE';

-- 5. Проверяем, какая версия функции accept_order используется
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'accept_order';



