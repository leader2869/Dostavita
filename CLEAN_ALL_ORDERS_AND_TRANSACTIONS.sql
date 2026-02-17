-- Очистка всех заказов и транзакций
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ заказы и транзакции!
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Удаляем все транзакции
DELETE FROM public.transactions;

-- 2. Сбрасываем все балансы в 0
UPDATE public.balances
SET 
  amount = 0,
  updated_at = NOW();

-- 3. Удаляем все заказы (или только завершенные - раскомментируйте нужный вариант)

-- Вариант 1: Удалить ВСЕ заказы
DELETE FROM public.orders;

-- Вариант 2: Удалить только завершенные заказы (раскомментируйте, если хотите оставить активные)
-- DELETE FROM public.orders WHERE status = 'completed';

-- 4. Проверяем результат
SELECT 
  'Результат очистки' as check_type,
  COUNT(*) as remaining_orders,
  (SELECT COUNT(*) FROM public.transactions) as remaining_transactions,
  (SELECT COUNT(*) FROM public.balances WHERE amount > 0) as balances_with_amount
FROM public.orders;

-- 5. Показываем текущие балансы (должны быть все 0)
SELECT 
  'Текущие балансы' as check_type,
  user_id,
  amount,
  currency,
  updated_at
FROM public.balances
ORDER BY updated_at DESC;

