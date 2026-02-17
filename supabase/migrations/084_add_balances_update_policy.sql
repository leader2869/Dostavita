-- Миграция 084: Добавление RLS политики UPDATE для balances
-- Хотя функции с SECURITY DEFINER обходят RLS, добавляем политику для надежности
-- Также добавляем политику для обновления баланса системой

-- Удаляем политику, если она уже существует
DROP POLICY IF EXISTS "Users can update own balance" ON public.balances;

-- Пользователи могут обновлять свой баланс (хотя обычно это делается через функции)
CREATE POLICY "Users can update own balance"
  ON public.balances FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "Users can update own balance" ON public.balances IS 'Позволяет пользователям обновлять свой баланс. Обычно баланс обновляется через функции с SECURITY DEFINER, но эта политика добавляется для надежности.';

