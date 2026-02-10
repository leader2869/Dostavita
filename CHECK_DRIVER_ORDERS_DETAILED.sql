-- Детальная проверка заказов водителя
-- Замените USER_ID на ID водителя: 3efb4975-5bfd-4151-920e-2ce5508f0729

-- 1. Проверяем все заказы с executor_user_id этого водителя
SELECT 
  id,
  executor_user_id,
  driver_id,
  status,
  created_at,
  accepted_at
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY created_at DESC;

-- 2. Проверяем все заказы со статусом courier_coming или courier_delivering
SELECT 
  id,
  executor_user_id,
  driver_id,
  status,
  created_at,
  accepted_at
FROM public.orders
WHERE status IN ('courier_coming', 'courier_delivering')
ORDER BY created_at DESC;

-- 3. Проверяем все заказы (последние 10)
SELECT 
  id,
  executor_user_id,
  driver_id,
  status,
  customer_id,
  client_id,
  created_at,
  accepted_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;

-- 4. Проверяем профиль водителя
SELECT 
  id,
  email,
  role,
  vehicle_type,
  vehicle_number,
  license_number
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 5. Проверяем, какая версия функции accept_order используется
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  prosrc as source_code
FROM pg_proc
WHERE proname = 'accept_order';

