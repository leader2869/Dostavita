-- Исправление: создание недостающих транзакций и обновление баланса
-- ВНИМАНИЕ: Выполните этот скрипт только после проверки CHECK_BALANCE_AND_TRANSACTIONS.sql
-- Этот скрипт создаст транзакции для оплаченных заказов и обновит баланс

-- Временно отключаем RLS для создания баланса и транзакций
ALTER TABLE public.balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- 1. Создаем баланс, если его нет
INSERT INTO public.balances (user_id, amount, currency, updated_at)
SELECT 
  '3efb4975-5bfd-4151-920e-2ce5508f0729'::UUID,
  0.00,
  'BYN',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.balances 
  WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Создаем транзакции для оплаченных заказов, для которых нет транзакций
INSERT INTO public.transactions (user_id, order_id, amount, type, description, created_at)
SELECT 
  o.executor_user_id,
  o.id,
  o.final_price,
  'credit',
  'Начисление за выполнение Заказа №' || o.order_number::TEXT,
  COALESCE(o.completed_at, o.created_at)
FROM public.orders o
WHERE o.executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND o.is_paid = true
  AND o.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.order_id = o.id 
      AND t.user_id = o.executor_user_id
  )
ON CONFLICT DO NOTHING;

-- 3. Обновляем баланс: суммируем все транзакции типа 'credit'
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

-- 4. Включаем RLS обратно
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 5. Проверяем результат
SELECT 
  'Результат' as check_type,
  b.amount as current_balance,
  COUNT(t.id) as transactions_count,
  COALESCE(SUM(t.amount), 0) as total_transactions_amount,
  CASE 
    WHEN b.amount = COALESCE(SUM(t.amount), 0) THEN '✅ Баланс соответствует транзакциям'
    ELSE '⚠️ Баланс не соответствует транзакциям'
  END as status
FROM public.balances b
LEFT JOIN public.transactions t ON t.user_id = b.user_id AND t.type = 'credit'
WHERE b.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
GROUP BY b.amount;

