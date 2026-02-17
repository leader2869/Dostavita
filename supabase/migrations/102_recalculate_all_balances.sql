-- Миграция 102: Пересчет балансов для всех пользователей на основе новой логики (миграция 101)
-- Для водителей: все credit - только debit от сдачи кассы
-- Для организаций: все credit - все debit

-- 1. Пересчитываем балансы для всех водителей
UPDATE public.balances b
SET 
  amount = public.calculate_driver_balance(b.user_id),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = b.user_id AND p.role = 'driver'
);

-- 2. Пересчитываем балансы для всех организаций
UPDATE public.balances b
SET 
  amount = (
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
    FROM public.transactions t
    WHERE t.user_id = b.user_id
  ),
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = b.user_id AND p.role = 'customer'
);

-- 3. Для пользователей без транзакций устанавливаем баланс в 0
UPDATE public.balances b
SET 
  amount = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t WHERE t.user_id = b.user_id
);

