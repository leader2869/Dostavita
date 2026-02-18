-- Скрипт для проверки работы функции accept_order
-- Замените ORDER_ID и USER_ID на реальные значения

-- 1. Проверяем заказ перед принятием
SELECT 
  id,
  status,
  executor_user_id,
  driver_id,
  created_at
FROM public.orders
WHERE id = 'ORDER_ID_HERE'; -- Замените на ID заказа

-- 2. Проверяем профиль водителя
SELECT 
  id,
  email,
  role,
  vehicle_type,
  license_number
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 3. Проверяем все заказы с executor_user_id этого водителя
SELECT 
  id,
  executor_user_id,
  status,
  created_at,
  accepted_at
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY created_at DESC;

-- 4. Проверяем все заказы со статусом searching_courier
SELECT 
  id,
  status,
  executor_user_id,
  driver_id,
  created_at
FROM public.orders
WHERE status = 'searching_courier'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Тестируем функцию accept_order вручную (замените ORDER_ID на реальный ID заказа)
-- SELECT public.accept_order('ORDER_ID_HERE'::uuid, '3efb4975-5bfd-4151-920e-2ce5508f0729'::uuid);




