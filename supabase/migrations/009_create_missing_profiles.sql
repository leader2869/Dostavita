-- Миграция 009: Создание профилей для пользователей, у которых их нет
-- Этот скрипт создает профили для всех пользователей из auth.users, у которых нет профиля в public.profiles

-- Создаем профили для всех пользователей без профилей
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

-- Создаем балансы для всех пользователей без балансов
INSERT INTO public.balances (user_id)
SELECT 
  u.id
FROM auth.users u
LEFT JOIN public.balances b ON u.id = b.user_id
WHERE b.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Выводим информацию о созданных профилях
DO $$
DECLARE
  profiles_created INTEGER;
  balances_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO profiles_created
  FROM auth.users u
  INNER JOIN public.profiles p ON u.id = p.id;
  
  SELECT COUNT(*) INTO balances_created
  FROM auth.users u
  INNER JOIN public.balances b ON u.id = b.user_id;
  
  RAISE NOTICE '✅ Профилей создано: %', profiles_created;
  RAISE NOTICE '✅ Балансов создано: %', balances_created;
END $$;

