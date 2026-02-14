-- Миграция 016: Исправление RLS политик для profiles
-- Убеждаемся, что пользователи могут создавать/обновлять только свой профиль

-- Удаляем все существующие политики INSERT для profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- Создаем правильную политику INSERT: пользователь может создавать только свой профиль
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Удаляем все существующие политики UPDATE для profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.profiles;

-- Создаем правильную политику UPDATE: пользователь может обновлять только свой профиль
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Удаляем все существующие политики SELECT для profiles (кроме админских)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON public.profiles;

-- Создаем правильную политику SELECT: пользователь может видеть только свой профиль
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Политики для админов оставляем без изменений (они уже правильные)
-- Админы могут видеть все профили через RPC функции


