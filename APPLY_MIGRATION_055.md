# Инструкция по применению миграции 055 для исправления рекурсии RLS

## Проблема
Ошибка "infinite recursion detected in policy for relation 'profiles'" возникает из-за того, что функции `check_user_role` и `is_driver_organization` делают SELECT из таблицы `profiles` без отключения RLS, что вызывает бесконечную рекурсию при проверке политик RLS.

## Решение
Миграция 055 исправляет эту проблему, отключая RLS в функциях перед SELECT из `profiles`.

## Как применить миграцию

### Вариант 1: Через Supabase Dashboard
1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Перейдите в раздел **SQL Editor**
3. Откройте файл `supabase/migrations/055_fix_rls_recursion_in_check_functions.sql`
4. Скопируйте весь содержимое файла
5. Вставьте в SQL Editor и нажмите **Run**

### Вариант 2: Через Supabase CLI
```bash
cd /Users/vitalymacbookair/Dostavita
supabase migration up
```

## Проверка после применения

После применения миграции выполните следующий SQL запрос для проверки:

```sql
-- Проверяем, что функции правильно определены
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname IN ('check_user_role', 'is_driver_organization', 'check_driver_role')
ORDER BY proname;

-- Проверяем политики для profiles
SELECT 
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

## Что делает миграция

1. **Удаляет ВСЕ потенциально проблемные политики**:
   - "Admins can view all profiles" (старая версия с прямым SELECT)
   - "Superadmins can update any profile" (старая версия с прямым SELECT)
   - "Organizations can view their drivers location" (пересоздается с исправленной функцией)

2. **Исправляет функцию `check_user_role`**:
   - Отключает RLS перед SELECT из `profiles` с помощью `set_config('row_security', 'off', true)`
   - Включает RLS обратно после SELECT
   - Обрабатывает ошибки и гарантирует включение RLS даже при исключениях

3. **Исправляет функцию `is_driver_organization`**:
   - Отключает RLS перед SELECT из `profiles` с помощью `set_config('row_security', 'off', true)`
   - Включает RLS обратно после SELECT
   - Обрабатывает ошибки и гарантирует включение RLS даже при исключениях

4. **Пересоздает все политики** с использованием исправленных функций:
   - "Organizations can view their drivers location"
   - "Admins can view all profiles"
   - "Superadmins can update any profile"

## После применения

После применения миграции ошибка "infinite recursion detected in policy for relation 'profiles'" должна исчезнуть. Обновление местоположения водителя должно работать корректно.

Если ошибка все еще возникает, проверьте:
1. Что миграция действительно применена (выполните проверочные запросы выше)
2. Что нет других мест в коде, которые делают прямой UPDATE к `profiles` без использования функций с отключенным RLS

