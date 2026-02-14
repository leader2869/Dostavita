-- Проверка передачи местоположения водителем
-- Замените 'driver@test.com' на email водителя

-- 1. Проверяем последние обновления местоположения водителя в таблице driver_locations
SELECT 
  dl.id,
  dl.driver_id,
  p.email as driver_email,
  p.full_name as driver_name,
  dl.latitude,
  dl.longitude,
  dl.order_id,
  o.order_number,
  o.status as order_status,
  dl.updated_at,
  dl.created_at,
  -- Время с последнего обновления
  NOW() - dl.updated_at as time_since_update,
  EXTRACT(EPOCH FROM (NOW() - dl.updated_at)) / 60 as minutes_since_update
FROM public.driver_locations dl
INNER JOIN public.profiles p ON dl.driver_id = p.id
LEFT JOIN public.orders o ON dl.order_id = o.id
WHERE p.email = 'driver@test.com'
ORDER BY dl.updated_at DESC
LIMIT 10;

-- 2. Проверяем current_location в профиле водителя
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.current_location,
  p.location_updated_at,
  -- Время с последнего обновления
  NOW() - p.location_updated_at as time_since_update,
  EXTRACT(EPOCH FROM (NOW() - p.location_updated_at)) / 60 as minutes_since_update
FROM public.profiles p
WHERE p.email = 'driver@test.com';

-- 3. Проверяем активные заказы водителя (для которых должно передаваться местоположение)
SELECT 
  o.id as order_id,
  o.order_number,
  o.status,
  o.executor_user_id,
  p.email as driver_email,
  o.created_at,
  o.accepted_at,
  o.picked_up_at,
  o.completed_at
FROM public.orders o
INNER JOIN public.profiles p ON o.executor_user_id = p.id
WHERE p.email = 'driver@test.com'
  AND o.status IN ('courier_coming', 'courier_delivering')
ORDER BY o.created_at DESC;

-- 4. Статистика обновлений местоположения за последние 24 часа
SELECT 
  COUNT(*) as total_updates,
  MIN(updated_at) as first_update,
  MAX(updated_at) as last_update,
  EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) / 60 as duration_minutes,
  ROUND(COUNT(*)::numeric / NULLIF(EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) / 60, 0) * 60, 2) as updates_per_hour
FROM public.driver_locations dl
INNER JOIN public.profiles p ON dl.driver_id = p.id
WHERE p.email = 'driver@test.com'
  AND dl.updated_at >= NOW() - INTERVAL '24 hours';

-- 5. Проверяем, есть ли записи в driver_locations за последний час
SELECT 
  COUNT(*) as updates_last_hour,
  MAX(updated_at) as last_update_time,
  NOW() - MAX(updated_at) as time_since_last_update
FROM public.driver_locations dl
INNER JOIN public.profiles p ON dl.driver_id = p.id
WHERE p.email = 'driver@test.com'
  AND dl.updated_at >= NOW() - INTERVAL '1 hour';

