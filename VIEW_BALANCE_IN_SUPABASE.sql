-- Просмотр баланса в Supabase
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Просмотр всех балансов
SELECT 
  b.id,
  b.user_id,
  p.email as user_email,
  p.role as user_role,
  b.amount,
  b.currency,
  b.updated_at
FROM public.balances b
LEFT JOIN public.profiles p ON b.user_id = p.id
ORDER BY b.updated_at DESC;

-- 2. Просмотр баланса конкретного пользователя (замените UUID на нужный)
SELECT 
  b.id,
  b.user_id,
  p.email as user_email,
  p.role as user_role,
  b.amount,
  b.currency,
  b.updated_at,
  -- Подсчитываем транзакции
  (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = b.user_id AND t.type = 'credit') as credit_transactions_count,
  (SELECT COALESCE(SUM(amount), 0) FROM public.transactions t WHERE t.user_id = b.user_id AND t.type = 'credit') as total_credit_amount
FROM public.balances b
LEFT JOIN public.profiles p ON b.user_id = p.id
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 3. Просмотр баланса и всех транзакций для конкретного пользователя
SELECT 
  'Баланс' as type,
  b.amount as amount,
  b.currency as currency,
  b.updated_at as date,
  NULL as order_number,
  NULL as description
FROM public.balances b
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'

UNION ALL

SELECT 
  'Транзакция' as type,
  t.amount as amount,
  NULL as currency,
  t.created_at as date,
  o.order_number::TEXT as order_number,
  t.description as description
FROM public.transactions t
LEFT JOIN public.orders o ON t.order_id = o.id
WHERE t.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY date DESC;

