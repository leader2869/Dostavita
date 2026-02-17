-- Проверка применения миграции 089 (триггеры)
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, существует ли триггер
SELECT 
  'Триггер' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  CASE 
    WHEN tgname = 'on_order_payment_processed' THEN '✅ Триггер существует'
    ELSE '❌ Триггер не найден'
  END as status
FROM pg_trigger
WHERE tgname = 'on_order_payment_processed'
  AND tgrelid = 'public.orders'::regclass;

-- 2. Проверяем, существует ли функция-триггер
SELECT 
  'Функция-триггер' as check_type,
  proname as function_name,
  CASE 
    WHEN proname = 'handle_order_payment' THEN '✅ Функция существует'
    ELSE '❌ Функция не найдена'
  END as status,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%SECURITY DEFINER%' THEN '✅ SECURITY DEFINER установлен'
    ELSE '❌ SECURITY DEFINER НЕ установлен'
  END as security_definer_status
FROM pg_proc
WHERE proname = 'handle_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Проверяем основную функцию process_order_payment
SELECT 
  'Основная функция' as check_type,
  proname as function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%UPDATE.*is_paid%' THEN '✅ Обновляет is_paid'
    ELSE '⚠️ Проверьте вручную'
  END as updates_is_paid
FROM pg_proc
WHERE proname = 'process_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 4. Проверяем последний заказ
SELECT 
  'Последний заказ' as check_type,
  id,
  order_number,
  status,
  is_paid,
  executor_user_id,
  final_price,
  completed_at
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY completed_at DESC NULLS LAST, created_at DESC
LIMIT 1;

-- 5. Проверяем, есть ли транзакции для последнего заказа
SELECT 
  'Транзакции' as check_type,
  t.id,
  t.user_id,
  t.order_id,
  t.amount,
  t.type,
  t.description,
  t.created_at
FROM public.transactions t
WHERE t.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY t.created_at DESC
LIMIT 5;

