-- Проверка применения миграции 085
-- Выполните этот скрипт в Supabase SQL Editor, чтобы проверить, применена ли миграция

-- 1. Проверяем, существует ли функция с правильной сигнатурой
SELECT 
  'Функция process_order_payment' as check_type,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) LIKE '%set_config%row_security%off%' as has_rls_bypass
FROM pg_proc
WHERE proname = 'process_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Проверяем, есть ли в функции код для отключения RLS
SELECT 
  'Код функции' as check_type,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%set_config%row_security%off%' THEN '✅ RLS bypass найден'
    ELSE '❌ RLS bypass НЕ найден'
  END as rls_bypass_status
FROM pg_proc
WHERE proname = 'process_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Проверяем баланс для тестового пользователя
SELECT 
  'Баланс пользователя' as check_type,
  user_id,
  amount,
  currency,
  updated_at
FROM public.balances
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 4. Проверяем транзакции для последних заказов
SELECT 
  'Транзакции' as check_type,
  t.id,
  t.user_id,
  t.order_id,
  t.amount,
  t.type,
  t.description,
  t.created_at,
  o.order_number,
  o.is_paid
FROM public.transactions t
LEFT JOIN public.orders o ON t.order_id = o.id
WHERE t.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY t.created_at DESC
LIMIT 10;

-- 5. Проверяем последние заказы с оплатой
SELECT 
  'Заказы с оплатой' as check_type,
  id,
  order_number,
  executor_user_id,
  final_price,
  is_paid,
  status,
  completed_at
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND is_paid = true
ORDER BY completed_at DESC
LIMIT 10;

