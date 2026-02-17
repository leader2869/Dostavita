-- Скрипт для проверки дебиторки организации
-- Замените 'YOUR_ORGANIZATION_ID' на ID вашей организации

-- 1. Проверяем структуру таблицы receivables
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'receivables'
ORDER BY ordinal_position;

-- 2. Проверяем все записи в receivables
SELECT 
  r.id,
  r.order_id,
  r.driver_user_id,
  r.organization_id,
  r.debtor_type,
  r.amount,
  r.status,
  r.created_at,
  o.order_number,
  d.full_name as driver_name,
  d.organization_id as driver_org_id
FROM public.receivables r
LEFT JOIN public.orders o ON o.id = r.order_id
LEFT JOIN public.profiles d ON r.driver_user_id = d.id
ORDER BY r.created_at DESC
LIMIT 20;

-- 3. Проверяем дебиторку для конкретной организации (замените на ваш ID)
-- SELECT * FROM public.receivables WHERE organization_id = 'YOUR_ORGANIZATION_ID';

-- 4. Проверяем, есть ли записи без organization_id
SELECT 
  COUNT(*) as count_without_org_id,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as count_with_org_id
FROM public.receivables
WHERE status = 'unpaid';

-- 5. Проверяем функцию get_organization_receivables
-- SELECT * FROM public.get_organization_receivables('YOUR_ORGANIZATION_ID', NULL, NULL);

-- 6. Проверяем водителей организации и их дебиторку
SELECT 
  d.id as driver_id,
  d.full_name as driver_name,
  d.organization_id,
  COUNT(r.id) as receivables_count,
  COALESCE(SUM(r.amount), 0) as total_receivables_amount
FROM public.profiles d
LEFT JOIN public.receivables r ON r.driver_user_id = d.id AND r.status = 'unpaid'
WHERE d.role = 'driver'
  AND d.organization_id IS NOT NULL
GROUP BY d.id, d.full_name, d.organization_id
ORDER BY receivables_count DESC;

