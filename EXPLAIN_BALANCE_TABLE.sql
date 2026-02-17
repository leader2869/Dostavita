-- Объяснение таблицы balances в Supabase
-- Выполните этот скрипт в Supabase SQL Editor для просмотра структуры таблицы

-- 1. Структура таблицы balances
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'balances'
ORDER BY ordinal_position;

-- 2. Показываем все записи в таблице balances
SELECT 
  'Все балансы' as check_type,
  id,
  user_id,
  amount,
  currency,
  updated_at
FROM public.balances
ORDER BY updated_at DESC;

-- 3. Показываем баланс конкретного пользователя
SELECT 
  'Баланс пользователя' as check_type,
  b.id,
  b.user_id,
  p.email as user_email,
  b.amount as balance_amount,
  b.currency,
  b.updated_at,
  -- Подсчитываем транзакции
  (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = b.user_id AND t.type = 'credit') as credit_transactions_count,
  (SELECT COALESCE(SUM(amount), 0) FROM public.transactions t WHERE t.user_id = b.user_id AND t.type = 'credit') as total_credit_amount
FROM public.balances b
LEFT JOIN public.profiles p ON b.user_id = p.id
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 4. Сравниваем баланс с суммой транзакций
SELECT 
  'Сравнение баланса и транзакций' as check_type,
  b.amount as balance_in_table,
  COALESCE(SUM(t.amount), 0) as sum_of_transactions,
  CASE 
    WHEN b.amount = COALESCE(SUM(t.amount), 0) THEN '✅ Баланс соответствует транзакциям'
    ELSE '⚠️ Баланс НЕ соответствует транзакциям'
  END as status,
  b.amount - COALESCE(SUM(t.amount), 0) as difference
FROM public.balances b
LEFT JOIN public.transactions t ON t.user_id = b.user_id AND t.type = 'credit'
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
GROUP BY b.amount;

