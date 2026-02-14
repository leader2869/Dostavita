-- Скрипт для проверки применения миграции 055
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, что функции отключают RLS
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%set_config%row_security%off%' THEN '✅ Отключает RLS'
    ELSE '❌ НЕ отключает RLS - МИГРАЦИЯ НЕ ПРИМЕНЕНА!'
  END as rls_status,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN ('check_user_role', 'is_driver_organization', 'check_driver_role')
ORDER BY proname;

-- 2. Проверяем политики для profiles
SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN qual LIKE '%check_user_role%' THEN '✅ Использует исправленную функцию'
    WHEN qual LIKE '%EXISTS%SELECT%FROM public.profiles%' THEN '❌ РЕКУРСИВНАЯ - ПРОБЛЕМА!'
    WHEN qual LIKE '%SELECT 1 FROM public.profiles%' THEN '❌ РЕКУРСИВНАЯ - ПРОБЛЕМА!'
    ELSE '⚠️ Проверьте вручную'
  END as status,
  LEFT(qual, 200) as policy_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 3. Проверяем политику для организаций
SELECT 
  policyname,
  CASE 
    WHEN qual LIKE '%organization_id = auth.uid()%' AND qual LIKE '%check_user_role%' THEN '✅ Правильная политика'
    WHEN qual LIKE '%for active orders%' THEN '❌ Ограничительная политика - нужно удалить!'
    ELSE '⚠️ Проверьте вручную'
  END as status
FROM pg_policies
WHERE tablename = 'profiles' 
  AND policyname LIKE '%Organizations%'
ORDER BY policyname;

-- 4. Проверяем политики для driver_locations
SELECT 
  policyname,
  CASE 
    WHEN qual LIKE '%organization_id = auth.uid()%' AND qual NOT LIKE '%active orders%' THEN '✅ Правильная политика'
    WHEN qual LIKE '%for active orders%' THEN '❌ Ограничительная политика - нужно удалить!'
    ELSE '⚠️ Проверьте вручную'
  END as status
FROM pg_policies
WHERE tablename = 'driver_locations' 
  AND policyname LIKE '%Organizations%'
ORDER BY policyname;

-- 5. Итоговый статус
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'check_user_role' 
        AND prosrc LIKE '%set_config%row_security%off%'
    ) 
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'profiles' 
        AND (qual LIKE '%EXISTS%SELECT%FROM public.profiles%' 
             OR qual LIKE '%SELECT 1 FROM public.profiles%')
    )
    THEN '✅ Миграция применена правильно'
    ELSE '❌ Миграция НЕ применена или применена неправильно!'
  END as migration_status;

