-- Миграция 112: Исправление RLS политик для таблицы transactions
-- Обеспечиваем доступ пользователей к своим транзакциям и организациям к транзакциям своих водителей

-- Удаляем все существующие политики для transactions (на случай конфликтов)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Organizations can view their drivers transactions" ON public.transactions;

-- Включаем RLS для таблицы transactions (на случай, если был отключен)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 1. Политика SELECT: Пользователи могут видеть свои транзакции
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Политика SELECT: Организации могут видеть транзакции своих водителей
CREATE POLICY "Organizations can view their drivers transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    -- Проверяем, что текущий пользователь - организация
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'customer'
    )
    AND
    -- Проверяем, что транзакция принадлежит водителю, привязанному к этой организации
    EXISTS (
      SELECT 1 FROM public.profiles d
      WHERE d.id = transactions.user_id
        AND d.role = 'driver'
        AND d.organization_id = auth.uid()
    )
  );

-- 3. Политика SELECT: Админы могут видеть все транзакции
CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Комментарии к политикам
COMMENT ON POLICY "Users can view own transactions" ON public.transactions IS 
  'Пользователи могут видеть свои собственные транзакции';

COMMENT ON POLICY "Organizations can view their drivers transactions" ON public.transactions IS 
  'Организации могут видеть транзакции всех своих привязанных водителей';

COMMENT ON POLICY "Admins can view all transactions" ON public.transactions IS 
  'Администраторы могут видеть все транзакции';

