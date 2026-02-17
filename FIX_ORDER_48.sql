-- Исправление заказа 48: создание транзакции и обновление баланса
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Создаем транзакцию для заказа 48, если её нет
INSERT INTO public.transactions (user_id, order_id, amount, type, description, created_at)
SELECT 
  o.executor_user_id,
  o.id,
  o.final_price,
  'credit',
  'Начисление за выполнение Заказа №' || o.order_number::TEXT,
  COALESCE(o.completed_at, o.created_at)
FROM public.orders o
WHERE o.order_number = 48
  AND o.is_paid = true
  AND o.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.order_id = o.id 
      AND t.user_id = o.executor_user_id
  )
ON CONFLICT DO NOTHING;

-- 2. Пересчитываем баланс на основе всех транзакций типа 'credit'
UPDATE public.balances
SET 
  amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.transactions
    WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
      AND type = 'credit'
  ),
  updated_at = NOW()
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 3. Если баланса нет, создаем его
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

-- 4. Проверяем результат
SELECT 
  'Результат' as check_type,
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
GROUP BY b.amount;

