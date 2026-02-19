-- Миграция 010: Исправление RLS политики для создания профилей
-- Добавляем политику INSERT для таблицы profiles, чтобы триггер мог создавать профили

-- Удаляем старую политику, если она существует (на случай повторного запуска)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Создаем политику для вставки профилей
-- Это позволяет триггеру handle_new_user() создавать профили при регистрации
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Также добавляем политику для создания балансов
DROP POLICY IF EXISTS "Users can insert own balance" ON public.balances;
CREATE POLICY "Users can insert own balance"
  ON public.balances FOR INSERT
  WITH CHECK (user_id = auth.uid());





