-- Проверка баланса и транзакций для пользователя
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем баланс пользователя
SELECT 
  'Баланс пользователя' as check_type,
  user_id,
  amount,
  currency,
  updated_at,
  CASE 
    WHEN amount IS NULL THEN '❌ Баланс НЕ существует'
    WHEN amount = 0 THEN '⚠️ Баланс существует, но равен 0'
    ELSE '✅ Баланс существует: ' || amount::TEXT || ' ' || currency
  END as status
FROM public.balances
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 2. Если баланса нет, создаем его
INSERT INTO public.balances (user_id, amount, currency, updated_at)
SELECT 
  '3efb4975-5bfd-4151-920e-2ce5508f0729'::UUID,
  0.00,
  'BYN',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.balances 
  WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
);

-- 3. Проверяем транзакции для оплаченных заказов
SELECT 
  'Транзакции' as check_type,
  t.id,
  t.user_id,
  t.order_id,
  o.order_number,
  t.amount,
  t.type,
  t.description,
  t.created_at,
  o.is_paid,
  o.status
FROM public.transactions t
LEFT JOIN public.orders o ON t.order_id = o.id
WHERE t.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY t.created_at DESC;

-- 4. Подсчитываем, сколько должно быть транзакций
SELECT 
  'Статистика' as check_type,
  COUNT(*) FILTER (WHERE o.is_paid = true) as paid_orders_count,
  COALESCE(SUM(o.final_price) FILTER (WHERE o.is_paid = true), 0) as total_paid_amount,
  COUNT(t.id) as transactions_count,
  COALESCE(SUM(t.amount), 0) as total_transactions_amount,
  (COUNT(*) FILTER (WHERE o.is_paid = true) - COUNT(t.id)) as missing_transactions
FROM public.orders o
LEFT JOIN public.transactions t ON t.order_id = o.id AND t.user_id = o.executor_user_id
WHERE o.executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND o.is_paid = true;

-- 5. Проверяем, есть ли в функции код для отключения RLS
SELECT 
  'Проверка функции' as check_type,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%set_config%row_security%off%' THEN '✅ RLS bypass найден в функции'
    ELSE '❌ RLS bypass НЕ найден в функции - миграция 085 не применена!'
  END as rls_bypass_status,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%SECURITY DEFINER%' THEN '✅ SECURITY DEFINER установлен'
    ELSE '❌ SECURITY DEFINER НЕ установлен'
  END as security_definer_status
FROM pg_proc
WHERE proname = 'process_order_payment'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

