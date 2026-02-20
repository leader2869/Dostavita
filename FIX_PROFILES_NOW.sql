-- БЫСТРОЕ ИСПРАВЛЕНИЕ: Создание профилей для всех пользователей
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Сначала добавляем политику INSERT, если её нет
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own balance" ON public.balances;
CREATE POLICY "Users can insert own balance"
  ON public.balances FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 2. Временно отключаем RLS для вставки (только для этого скрипта)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances DISABLE ROW LEVEL SECURITY;

-- 3. Создаем профили для всех пользователей без профилей
INSERT INTO public.profiles (id, email, role)
SELECT 
  u.id,
  u.email,
  COALESCE(
    (u.raw_user_meta_data->>'role')::TEXT,
    'client'
  ) as role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Создаем балансы для всех пользователей без балансов
INSERT INTO public.balances (user_id, amount, currency)
SELECT 
  u.id,
  0.00,
  'BYN'
FROM auth.users u
LEFT JOIN public.balances b ON u.id = b.user_id
WHERE b.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 5. Включаем RLS обратно
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- 6. Проверяем результат
SELECT 
  u.id,
  u.email,
  p.id as profile_id,
  p.role as profile_role,
  b.user_id as balance_user_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.balances b ON u.id = b.user_id
ORDER BY u.created_at DESC;






