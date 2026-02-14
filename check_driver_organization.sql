-- Проверка привязки водителя к организации и активных заказов
-- Замените 'driver@test.com' на email водителя и 'ORGANIZATION_EMAIL' на email организации

-- 1. Проверяем водителя и его привязку к организации
SELECT 
  driver.id as driver_id,
  driver.email as driver_email,
  driver.full_name as driver_name,
  driver.organization_id,
  driver.role,
  -- Проверяем, какая организация привязана
  org.id as organization_id_check,
  org.email as organization_email,
  org.full_name as organization_name,
  CASE 
    WHEN driver.organization_id IS NULL THEN '❌ Водитель НЕ привязан к организации'
    WHEN driver.organization_id = org.id THEN '✅ Водитель привязан к организации'
    ELSE '⚠️ Водитель привязан к другой организации'
  END as organization_status
FROM public.profiles driver
LEFT JOIN public.profiles org ON driver.organization_id = org.id
WHERE driver.email = 'driver@test.com';

-- 2. Проверяем активные заказы водителя
SELECT 
  o.id as order_id,
  o.order_number,
  o.status,
  o.executor_user_id,
  o.customer_id,
  o.client_id,
  -- Кто заказчик
  customer.email as customer_email,
  customer.full_name as customer_name,
  -- Кто клиент
  client.email as client_email,
  client.full_name as client_name
FROM public.orders o
LEFT JOIN public.profiles customer ON o.customer_id = customer.id
LEFT JOIN public.profiles client ON o.client_id = client.id
WHERE o.executor_user_id = (SELECT id FROM public.profiles WHERE email = 'driver@test.com')
AND o.status IN ('courier_coming', 'courier_delivering');

-- 3. Симулируем работу функции get_organization_drivers_with_active_orders
-- Сначала найдем ID организации, к которой привязан водитель
WITH driver_org AS (
  SELECT 
    driver.id as driver_id,
    driver.organization_id as org_id
  FROM public.profiles driver
  WHERE driver.email = 'driver@test.com'
)
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
  AND o.status IN ('courier_coming', 'courier_delivering')
INNER JOIN driver_org drv_org ON p.organization_id = drv_org.org_id
WHERE p.organization_id = drv_org.org_id
  AND p.role = 'driver'
  AND p.id = drv_org.driver_id
ORDER BY p.id, o.created_at DESC;

-- 4. Проверяем, применена ли функция в базе данных
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname = 'get_organization_drivers_with_active_orders';

