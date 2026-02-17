-- Проверка существования функций
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, существуют ли вспомогательные функции
SELECT 
  'Вспомогательные функции' as check_type,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  CASE 
    WHEN proname = 'create_or_update_balance' THEN 
      CASE 
        WHEN pg_get_functiondef(oid) LIKE '%set_config%row_security%off%' THEN '✅ Функция существует с RLS bypass'
        ELSE '⚠️ Функция существует, но без RLS bypass'
      END
    WHEN proname = 'create_transaction' THEN 
      CASE 
        WHEN pg_get_functiondef(oid) LIKE '%set_config%row_security%off%' THEN '✅ Функция существует с RLS bypass'
        ELSE '⚠️ Функция существует, но без RLS bypass'
      END
    ELSE '❌ Функция не найдена'
  END as status
FROM pg_proc
WHERE proname IN ('create_or_update_balance', 'create_transaction')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Проверяем основную функцию process_order_payment
SELECT 
  'Основная функция' as check_type,
  proname as function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%create_transaction%' THEN '✅ Использует create_transaction'
    ELSE '❌ НЕ использует create_transaction'
  END as uses_create_transaction,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%create_or_update_balance%' THEN '✅ Использует create_or_update_balance'
    ELSE '❌ НЕ использует create_or_update_balance'
  END as uses_create_balance
FROM pg_proc
WHERE proname = 'process_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Проверяем, есть ли транзакции для последнего заказа
SELECT 
  'Транзакции для заказа 48' as check_type,
  t.id,
  t.user_id,
  t.order_id,
  t.amount,
  t.type,
  t.description,
  t.created_at
FROM public.transactions t
WHERE t.order_id = 'aa3de336-1266-4dcc-9eb6-8d716c80cbdd'
  OR EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = t.order_id 
      AND o.order_number = 48
  );

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

