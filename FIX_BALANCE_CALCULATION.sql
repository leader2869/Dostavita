-- Исправление расчета баланса
-- Баланс должен быть суммой всех транзакций типа 'credit' (оплаченные заказы)
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Пересчитываем баланс для всех пользователей на основе транзакций
UPDATE public.balances b
SET 
  amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.transactions t
    WHERE t.user_id = b.user_id
      AND t.type = 'credit'
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.transactions t WHERE t.user_id = b.user_id AND t.type = 'credit'
);

-- 2. Для пользователей без транзакций устанавливаем баланс в 0
UPDATE public.balances b
SET 
  amount = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t WHERE t.user_id = b.user_id AND t.type = 'credit'
);

-- 3. Проверяем результат для конкретного пользователя
SELECT 
  'Баланс и транзакции' as check_type,
  b.user_id,
  b.amount as current_balance,
  COUNT(t.id) as credit_transactions_count,
  COALESCE(SUM(t.amount), 0) as total_credit_amount,
  CASE 
    WHEN b.amount = COALESCE(SUM(t.amount), 0) THEN '✅ Баланс соответствует транзакциям'
    ELSE '⚠️ Баланс не соответствует транзакциям'
  END as status
FROM public.balances b
LEFT JOIN public.transactions t ON t.user_id = b.user_id AND t.type = 'credit'
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
GROUP BY b.user_id, b.amount;

-- 4. Показываем все транзакции для проверки
SELECT 
  'Транзакции' as check_type,
  t.id,
  t.user_id,
  t.order_id,
  o.order_number,
  o.is_paid,
  t.amount,
  t.type,
  t.description,
  t.created_at
FROM public.transactions t
LEFT JOIN public.orders o ON t.order_id = o.id
WHERE t.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY t.created_at DESC;

