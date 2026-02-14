-- Диагностика проблемы с отображением водителей на странице tracking
-- Проверяем, почему водитель с активным заказом не отображается

-- 1. Проверяем данные водителя driver@test.com
SELECT 
  p.id as driver_user_id,
  p.email as driver_email,
  p.full_name as driver_name,
  p.role,
  p.organization_id,
  -- Проверяем, какая организация привязана
  org_p.email as organization_email,
  org_p.full_name as organization_name
FROM public.profiles p
LEFT JOIN public.profiles org_p ON p.organization_id = org_p.id
WHERE p.email = 'driver@test.com';

-- 2. Проверяем активные заказы водителя и их customer_id
SELECT 
  o.id as order_id,
  o.order_number,
  o.status,
  o.executor_user_id,
  o.customer_id,
  o.client_id,
  -- Кто заказчик (организация)
  customer_p.email as customer_email,
  customer_p.full_name as customer_name,
  customer_p.role as customer_role,
  -- Кто клиент
  client_p.email as client_email,
  client_p.full_name as client_name
FROM public.orders o
LEFT JOIN public.profiles customer_p ON o.customer_id = customer_p.id
LEFT JOIN public.profiles client_p ON o.client_id = client_p.id
WHERE o.executor_user_id = (
  SELECT id FROM public.profiles WHERE email = 'driver@test.com'
)
AND o.status IN ('courier_coming', 'courier_delivering')
ORDER BY o.created_at DESC;

-- 3. Проверяем, какие организации есть в системе
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  COUNT(d.id) as drivers_count
FROM public.profiles p
LEFT JOIN public.profiles d ON d.organization_id = p.id AND d.role = 'driver'
WHERE p.role = 'customer'
GROUP BY p.id, p.email, p.full_name, p.role
ORDER BY p.created_at DESC;

-- 4. Симулируем работу функции get_organization_drivers_with_active_orders
-- Замените 'ORGANIZATION_USER_ID' на реальный ID организации
SELECT DISTINCT ON (p.id)
  p.id,
  p.email,
  p.full_name,
  p.phone,
  p.vehicle_type,
  p.vehicle_number,
  p.license_number,
  p.current_location,
  p.location_updated_at,
  p.avatar_url,
  p.created_at,
  o.id as active_order_id,
  o.status as active_order_status
FROM public.profiles p
INNER JOIN public.orders o ON o.executor_user_id = p.id
  AND o.customer_id = (SELECT id FROM public.profiles WHERE email = 'driver@test.com' LIMIT 1) -- ВРЕМЕННО: используем ID водителя для теста
  AND o.status IN ('courier_coming', 'courier_delivering')
WHERE p.organization_id = (SELECT id FROM public.profiles WHERE email = 'driver@test.com' LIMIT 1) -- ВРЕМЕННО: используем ID водителя для теста
  AND p.role = 'driver'
ORDER BY p.id, o.created_at DESC;

-- 5. Проверяем правильность связей: водитель -> организация -> заказы
WITH driver_info AS (
  SELECT id, email, organization_id 
  FROM public.profiles 
  WHERE email = 'driver@test.com'
),
organization_info AS (
  SELECT di.id as driver_id, di.email as driver_email, di.organization_id, org.id as org_id, org.email as org_email
  FROM driver_info di
  LEFT JOIN public.profiles org ON di.organization_id = org.id
)
SELECT 
  oi.driver_email,
  oi.organization_id as driver_org_id,
  oi.org_email as organization_email,
  o.id as order_id,
  o.order_number,
  o.status,
  o.customer_id as order_customer_id,
  customer_p.email as order_customer_email,
  CASE 
    WHEN oi.organization_id = o.customer_id THEN '✅ СОВПАДАЕТ'
    ELSE '❌ НЕ СОВПАДАЕТ'
  END as match_status
FROM organization_info oi
LEFT JOIN public.orders o ON o.executor_user_id = oi.driver_id
  AND o.status IN ('courier_coming', 'courier_delivering')
LEFT JOIN public.profiles customer_p ON o.customer_id = customer_p.id;

