-- Проверка баланса после создания транзакции
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем баланс пользователя
SELECT 
  'Баланс пользователя' as check_type,
  user_id,
  amount as current_balance,
  currency,
  updated_at
FROM public.balances
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 2. Подсчитываем сумму всех транзакций типа 'credit'
SELECT 
  'Сумма транзакций' as check_type,
  COUNT(*) as credit_transactions_count,
  COALESCE(SUM(amount), 0) as total_credit_amount
FROM public.transactions
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND type = 'credit';

-- 3. Сравниваем баланс с суммой транзакций
SELECT 
  'Сравнение' as check_type,
  b.amount as current_balance,
  COALESCE(SUM(t.amount), 0) as total_transactions_amount,
  CASE 
    WHEN b.amount = COALESCE(SUM(t.amount), 0) THEN '✅ Баланс соответствует транзакциям'
    ELSE '⚠️ Баланс НЕ соответствует транзакциям - нужно обновить'
  END as status
FROM public.balances b
LEFT JOIN public.transactions t ON t.user_id = b.user_id AND t.type = 'credit'
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
GROUP BY b.amount;

-- 4. Если баланса нет, создаем его и пересчитываем
INSERT INTO public.balances (user_id, amount, currency, updated_at)
SELECT 
  '3efb4975-5bfd-4151-920e-2ce5508f0729'::UUID,
  COALESCE(SUM(amount), 0),
  'BYN',
  NOW()
FROM public.transactions
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND type = 'credit'
ON CONFLICT (user_id) DO UPDATE
SET 
  amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.transactions
    WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
      AND type = 'credit'
  ),
  updated_at = NOW();

-- 5. Проверяем результат
SELECT 
  'Результат' as check_type,
  b.amount as current_balance,
  COUNT(t.id) as credit_transactions_count,
  COALESCE(SUM(t.amount), 0) as total_credit_amount,
  CASE 
    WHEN b.amount = COALESCE(SUM(t.amount), 0) THEN '✅ Баланс соответствует транзакциям'
    ELSE '⚠️ Баланс НЕ соответствует транзакциям'
  END as status
FROM public.balances b
LEFT JOIN public.transactions t ON t.user_id = b.user_id AND t.type = 'credit'
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
GROUP BY b.amount;

