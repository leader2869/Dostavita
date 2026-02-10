-- Диагностика заказов водителя
-- Замените DRIVER_USER_ID на ID водителя: 3efb4975-5bfd-4151-920e-2ce5508f0729

-- 1. Все заказы в системе (последние 10)
SELECT 
  id,
  status,
  executor_user_id,
  customer_id,
  client_id,
  created_at,
  accepted_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;

-- 2. Заказы, где executor_user_id = ID водителя
SELECT 
  id,
  status,
  executor_user_id,
  customer_id,
  client_id,
  created_at,
  accepted_at,
  picked_up_at,
  completed_at
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY created_at DESC;

-- 3. Заказы со статусом searching_courier (доступные для принятия)
SELECT 
  id,
  status,
  executor_user_id,
  customer_id,
  client_id,
  created_at
FROM public.orders
WHERE status = 'searching_courier'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Проверка профиля водителя
SELECT 
  id,
  email,
  role,
  vehicle_type,
  vehicle_number,
  license_number,
  created_at
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 5. Проверка функции accept_order
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'accept_order'
ORDER BY oid DESC;

-- 6. Проверка RLS политик для orders
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;

