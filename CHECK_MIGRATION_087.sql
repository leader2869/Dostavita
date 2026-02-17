-- Проверка применения миграции 087
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, существуют ли вспомогательные функции
SELECT 
  'Вспомогательные функции' as check_type,
  proname as function_name,
  CASE 
    WHEN proname = 'create_or_update_balance' THEN '✅ Функция create_or_update_balance существует'
    WHEN proname = 'create_transaction' THEN '✅ Функция create_transaction существует'
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
    WHEN pg_get_functiondef(oid) LIKE '%create_or_update_balance%' THEN '✅ Использует create_or_update_balance'
    ELSE '❌ НЕ использует create_or_update_balance'
  END as uses_helper_functions,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%SECURITY DEFINER%' THEN '✅ SECURITY DEFINER установлен'
    ELSE '❌ SECURITY DEFINER НЕ установлен'
  END as security_definer_status
FROM pg_proc
WHERE proname = 'process_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Проверяем заказ 45 (последний заказ)
SELECT 
  'Заказ 45' as check_type,
  id,
  order_number,
  status,
  is_paid,
  executor_user_id,
  final_price,
  completed_at
FROM public.orders
WHERE order_number = 45
  OR id = '2723a752-d069-4b1d-8483-3661c0c237fd';

-- 4. Проверяем баланс и транзакции
SELECT 
  'Баланс и транзакции' as check_type,
  b.amount as current_balance,
  COUNT(t.id) as transactions_count,
  COALESCE(SUM(t.amount), 0) as total_transactions_amount
FROM public.balances b
LEFT JOIN public.transactions t ON t.user_id = b.user_id AND t.type = 'credit'
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
GROUP BY b.amount;

