-- ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С ПРОФИЛЕМ
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, существует ли пользователь
SELECT 
  'Пользователь' as check_type,
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed
FROM auth.users
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 2. Проверяем, существует ли профиль (БЕЗ RLS - используем service role)
SELECT 
  'Профиль (прямой запрос)' as check_type,
  id,
  email,
  role
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

-- 3. Проверяем RLS политики
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 4. ВРЕМЕННО отключаем RLS для создания профиля
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances DISABLE ROW LEVEL SECURITY;

-- 5. Создаем профиль для пользователя (если его нет)
INSERT INTO public.profiles (id, email, role)
SELECT 
  u.id,
  u.email,
  COALESCE(
    (u.raw_user_meta_data->>'role')::TEXT,
    'driver'  -- По умолчанию driver, так как это test3@mail.ru
  ) as role
FROM auth.users u
WHERE u.id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = u.id
  )
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  role = COALESCE(EXCLUDED.role, profiles.role);

-- 6. Создаем баланс (если его нет)
INSERT INTO public.balances (user_id, amount, currency)
SELECT 
  u.id,
  0.00,
  'BYN'
FROM auth.users u
WHERE u.id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND NOT EXISTS (
    SELECT 1 FROM public.balances WHERE user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- 7. Включаем RLS обратно
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- 8. Финальная проверка
SELECT 
  'Финальная проверка' as check_type,
  u.id as user_id,
  u.email,
  p.id as profile_id,
  p.role as profile_role,
  b.user_id as balance_exists,
  CASE 
    WHEN p.id IS NULL THEN '❌ Профиль НЕ создан'
    ELSE '✅ Профиль создан'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.balances b ON u.id = b.user_id
WHERE u.id = '3efb4975-5bfd-4151-920e-2ce5508f0729';






