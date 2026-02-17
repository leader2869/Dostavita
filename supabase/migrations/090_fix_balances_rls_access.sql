-- Миграция 090: Исправление RLS политик для таблицы balances
-- Обеспечиваем полный доступ пользователей к своему балансу

-- Удаляем все существующие политики для balances (на случай конфликтов)
DROP POLICY IF EXISTS "Users can view own balance" ON public.balances;
DROP POLICY IF EXISTS "Users can insert own balance" ON public.balances;
DROP POLICY IF EXISTS "Users can update own balance" ON public.balances;
DROP POLICY IF EXISTS "Admins can view all balances" ON public.balances;

-- Включаем RLS для таблицы balances (на случай, если был отключен)
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- 1. Политика SELECT: Пользователи могут видеть свой баланс
CREATE POLICY "Users can view own balance"
  ON public.balances FOR SELECT
  USING (user_id = auth.uid());

-- 2. Политика INSERT: Пользователи могут создавать свой баланс
CREATE POLICY "Users can insert own balance"
  ON public.balances FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Политика UPDATE: Пользователи могут обновлять свой баланс
CREATE POLICY "Users can update own balance"
  ON public.balances FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Политика для админов: Админы могут видеть все балансы
CREATE POLICY "Admins can view all balances"
  ON public.balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Комментарии к политикам
COMMENT ON POLICY "Users can view own balance" ON public.balances IS 
  'Позволяет пользователям видеть свой собственный баланс';

COMMENT ON POLICY "Users can insert own balance" ON public.balances IS 
  'Позволяет пользователям создавать свой баланс (обычно через триггеры)';

COMMENT ON POLICY "Users can update own balance" ON public.balances IS 
  'Позволяет пользователям обновлять свой баланс (обычно через функции с SECURITY DEFINER)';

COMMENT ON POLICY "Admins can view all balances" ON public.balances IS 
  'Позволяет администраторам видеть все балансы в системе';

