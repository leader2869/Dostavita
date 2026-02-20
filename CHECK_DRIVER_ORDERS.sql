-- Скрипт для проверки заказов водителя
-- Замените USER_ID на ID водителя: 3efb4975-5bfd-4151-920e-2ce5508f0729

-- 1. Проверяем, есть ли заказы с executor_user_id этого водителя
SELECT 
  id,
  executor_user_id,
  status,
  created_at,
  accepted_at
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY created_at DESC;

-- 2. Проверяем профиль водителя
SELECT 
  id,
  email,
  role,
  vehicle_type,
  vehicle_number,
  license_number
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 3. Проверяем, какая версия функции accept_order используется
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'accept_order';

-- 4. Проверяем все заказы со статусом searching_courier
SELECT 
  id,
  status,
  executor_user_id,
  created_at
FROM public.orders
WHERE status = 'searching_courier'
ORDER BY created_at DESC
LIMIT 10;






