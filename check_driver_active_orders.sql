-- Проверка активных заказов у водителя driver@test.com
-- Активные статусы: courier_coming, courier_delivering

-- 1. Находим ID пользователя по email
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  p.role
FROM public.profiles p
WHERE p.email = 'driver@test.com';

-- 2. Проверяем активные заказы этого водителя
SELECT 
  o.id as order_id,
  o.order_number,
  o.status,
  o.pickup_address,
  o.delivery_address,
  o.created_at,
  o.accepted_at,
  o.picked_up_at,
  o.completed_at,
  o.executor_user_id,
  -- Информация о клиенте
  client_p.full_name as client_name,
  client_p.email as client_email,
  -- Информация о заказчике (организации)
  customer_p.full_name as customer_name,
  customer_p.email as customer_email
FROM public.orders o
LEFT JOIN public.profiles client_p ON o.client_id = client_p.id
LEFT JOIN public.profiles customer_p ON o.customer_id = customer_p.id
WHERE o.executor_user_id = (
  SELECT id FROM public.profiles WHERE email = 'driver@test.com'
)
AND o.status IN ('courier_coming', 'courier_delivering')
ORDER BY o.created_at DESC;

-- 3. Подсчет активных заказов
SELECT 
  COUNT(*) as active_orders_count
FROM public.orders o
WHERE o.executor_user_id = (
  SELECT id FROM public.profiles WHERE email = 'driver@test.com'
)
AND o.status IN ('courier_coming', 'courier_delivering');

