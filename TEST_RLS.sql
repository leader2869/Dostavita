-- Тест RLS политик для профилей
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, какие политики активны
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. Проверяем, включен ли RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 3. Тестируем auth.uid() (должен вернуть null в SQL Editor, но работать в запросах через клиент)
SELECT 
  auth.uid() as current_user_id,
  '3efb4975-5bfd-4151-920e-2ce5508f0729' as expected_user_id,
  CASE 
    WHEN auth.uid() = '3efb4975-5bfd-4151-920e-2ce5508f0729'::uuid THEN '✅ Совпадает'
    WHEN auth.uid() IS NULL THEN '⚠️ auth.uid() = NULL (нормально для SQL Editor)'
    ELSE '❌ Не совпадает'
  END as status;

-- 4. Проверяем, может ли политика найти профиль
-- (Этот запрос покажет, что политика видит)
SELECT 
  id,
  email,
  role,
  auth.uid() as current_auth_uid,
  CASE 
    WHEN auth.uid() = id THEN '✅ Политика разрешит доступ'
    WHEN auth.uid() IS NULL THEN '⚠️ auth.uid() = NULL - политика заблокирует'
    ELSE '❌ Политика заблокирует'
  END as policy_result
FROM public.profiles
WHERE id = '3efb4975-5bfd-4151-920e-2ce5508f0729';





