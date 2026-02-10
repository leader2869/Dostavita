-- Создание пользователя с ролью superadmin
-- Выполните этот скрипт в Supabase SQL Editor

-- ВАРИАНТ 1: Создание нового пользователя через Supabase Auth API
-- Используйте этот вариант, если хотите создать нового пользователя
-- После выполнения этого скрипта, зарегистрируйте пользователя через Supabase Dashboard -> Authentication -> Users -> Add User
-- Затем выполните часть "Обновление роли существующего пользователя"

-- ВАРИАНТ 2: Обновление роли существующего пользователя
-- Если у вас уже есть пользователь, укажите его email здесь:
DO $$
DECLARE
  user_email TEXT := 'admin@dostavita.com'; -- УКАЖИТЕ EMAIL ПОЛЬЗОВАТЕЛЯ
  user_id UUID;
BEGIN
  -- Находим пользователя по email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE NOTICE '❌ Пользователь с email % не найден', user_email;
    RAISE NOTICE 'Создайте пользователя через Supabase Dashboard -> Authentication -> Users -> Add User';
    RAISE NOTICE 'Затем укажите его email в переменной user_email и выполните скрипт снова';
  ELSE
    RAISE NOTICE '✅ Пользователь найден: ID = %, Email = %', user_id, user_email;
    
    -- Обновляем роль в профиле
    UPDATE public.profiles
    SET role = 'superadmin'
    WHERE id = user_id;
    
    IF FOUND THEN
      RAISE NOTICE '✅ Роль успешно обновлена на superadmin';
    ELSE
      -- Если профиля нет, создаем его
      INSERT INTO public.profiles (id, email, role)
      VALUES (user_id, user_email, 'superadmin')
      ON CONFLICT (id) DO UPDATE SET role = 'superadmin';
      
      RAISE NOTICE '✅ Профиль создан с ролью superadmin';
    END IF;
  END IF;
END $$;

-- Проверка результата
SELECT 
  u.id,
  u.email,
  p.role,
  CASE 
    WHEN p.role = 'superadmin' THEN '✅ Суперадмин'
    ELSE '❌ Не суперадмин'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.role = 'superadmin'
ORDER BY u.created_at DESC;

