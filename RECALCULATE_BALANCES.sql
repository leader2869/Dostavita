-- Пересчет балансов для всех пользователей на основе новой логики (миграция 101)
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

-- 4. Показываем результаты пересчета
SELECT 
  p.role,
  p.full_name,
  b.user_id,
  b.amount as current_balance,
  COUNT(t.id) FILTER (WHERE t.type = 'credit') as credit_count,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0) as total_credit,
  COUNT(t.id) FILTER (WHERE t.type = 'debit') as debit_count,
  COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'debit'), 0) as total_debit,
  CASE 
    WHEN p.role = 'driver' THEN 
      public.calculate_driver_balance(b.user_id)
    ELSE
      COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0)
  END as calculated_balance,
  CASE 
    WHEN p.role = 'driver' THEN 
      CASE WHEN b.amount = public.calculate_driver_balance(b.user_id) THEN '✅' ELSE '⚠️' END
    ELSE
      CASE 
        WHEN b.amount = (
          COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0)
        ) THEN '✅' 
        ELSE '⚠️' 
      END
  END as status
FROM public.balances b
LEFT JOIN public.profiles p ON p.id = b.user_id
LEFT JOIN public.transactions t ON t.user_id = b.user_id
GROUP BY p.role, p.full_name, b.user_id, b.amount
ORDER BY p.role, p.full_name;

