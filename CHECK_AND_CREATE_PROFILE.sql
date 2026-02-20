-- Проверка и создание профиля для test3@mail.ru

-- 1. Проверяем, существует ли пользователь
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'test3@mail.ru';

-- 2. Проверяем, существует ли профиль
SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.phone
FROM public.profiles p
INNER JOIN auth.users u ON p.id = u.id
WHERE u.email = 'test3@mail.ru';

-- 3. Если профиля нет, создаем его
-- Сначала получаем ID пользователя
DO $$
DECLARE
  user_id UUID;
  user_email TEXT;
  user_role TEXT;
BEGIN
  -- Получаем ID пользователя
  SELECT id, email, COALESCE((raw_user_meta_data->>'role')::TEXT, 'client')
  INTO user_id, user_email, user_role
  FROM auth.users
  WHERE email = 'test3@mail.ru';
  
  IF user_id IS NULL THEN
    RAISE NOTICE '❌ Пользователь test3@mail.ru не найден в auth.users';
  ELSE
    RAISE NOTICE '✅ Пользователь найден: ID = %, Email = %', user_id, user_email;
    
    -- Проверяем, есть ли профиль
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
      RAISE NOTICE '⚠️ Профиль не найден, создаем...';
      
      -- Создаем профиль
      INSERT INTO public.profiles (id, email, role)
      VALUES (user_id, user_email, COALESCE(user_role, 'client'))
      ON CONFLICT (id) DO NOTHING;
      
      RAISE NOTICE '✅ Профиль создан';
    ELSE
      RAISE NOTICE '✅ Профиль уже существует';
    END IF;
    
    -- Проверяем баланс
    IF NOT EXISTS (SELECT 1 FROM public.balances WHERE user_id = user_id) THEN
      RAISE NOTICE '⚠️ Баланс не найден, создаем...';
      
      INSERT INTO public.balances (user_id, amount, currency)
      VALUES (user_id, 0.00, 'BYN')
      ON CONFLICT (user_id) DO NOTHING;
      
      RAISE NOTICE '✅ Баланс создан';
    ELSE
      RAISE NOTICE '✅ Баланс уже существует';
    END IF;
  END IF;
END $$;

-- 4. Финальная проверка
SELECT 
  u.id as user_id,
  u.email,
  p.id as profile_id,
  p.role as profile_role,
  p.full_name,
  b.user_id as balance_exists
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.balances b ON u.id = b.user_id
WHERE u.email = 'test3@mail.ru';






