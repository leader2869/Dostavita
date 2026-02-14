-- Диагностический скрипт для проверки исправления рекурсии RLS
-- Выполните этот скрипт в Supabase SQL Editor для проверки состояния

-- 1. Проверяем, что функции правильно определены и отключают RLS
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%set_config%row_security%off%' THEN '✅ Отключает RLS'
    ELSE '❌ НЕ отключает RLS'
  END as rls_disabled_check,
  prosrc as function_body
FROM pg_proc
WHERE proname IN ('check_user_role', 'is_driver_organization', 'check_driver_role')
ORDER BY proname;

-- 2. Проверяем политики для profiles
SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN qual LIKE '%check_user_role%' OR qual LIKE '%check_driver_role%' THEN '✅ Использует функцию'
    WHEN qual LIKE '%EXISTS%SELECT%FROM public.profiles%' THEN '❌ Рекурсивный SELECT'
    WHEN qual LIKE '%SELECT 1 FROM public.profiles%' THEN '❌ Рекурсивный SELECT'
    ELSE '⚠️ Проверьте вручную'
  END as recursion_check,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 3. Проверяем, есть ли старые рекурсивные политики
SELECT 
  'Старые рекурсивные политики' as check_type,
  COUNT(*) as count
FROM pg_policies
WHERE tablename = 'profiles'
  AND (
    qual LIKE '%EXISTS%SELECT%FROM public.profiles%'
    OR qual LIKE '%SELECT 1 FROM public.profiles%'
  );

-- 4. Тестируем функцию check_user_role (должна работать без рекурсии)
-- Замените 'YOUR_USER_ID' на реальный UUID пользователя
-- SELECT public.check_user_role('YOUR_USER_ID'::UUID, 'driver') as is_driver;

-- 5. Проверяем, что функции имеют SECURITY DEFINER
SELECT 
  proname as function_name,
  CASE 
    WHEN prosecdef = true THEN '✅ SECURITY DEFINER'
    ELSE '❌ НЕ SECURITY DEFINER'
  END as security_definer_check
FROM pg_proc
WHERE proname IN ('check_user_role', 'is_driver_organization', 'check_driver_role')
ORDER BY proname;

