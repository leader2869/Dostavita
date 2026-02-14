-- Миграция 005: Создание тестовых пользователей для всех ролей

-- Внимание: Этот скрипт создает тестовых пользователей через auth.users
-- Пароли для всех пользователей: Test123456!

-- Функция для создания пользователя и профиля
CREATE OR REPLACE FUNCTION create_test_user(
  email TEXT,
  password TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT
) RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Создаем пользователя в auth.users (используем service role)
  -- Внимание: В реальном проекте это должно делаться через Supabase Auth API
  -- Здесь мы создаем только профили, предполагая что пользователи уже созданы через UI
  
  -- Для тестирования создадим записи напрямую в profiles
  -- В production пользователи должны регистрироваться через /register
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Создаем тестовых пользователей
-- ВАЖНО: Эти пользователи должны быть созданы через Supabase Auth UI или API
-- Здесь мы только создаем инструкции

-- Для создания тестовых пользователей:
-- 1. Зарегистрируйтесь через /register как customer
-- 2. Затем в Supabase Dashboard обновите роль в таблице profiles:
--    UPDATE profiles SET role = 'driver' WHERE email = 'driver@test.com';
--    UPDATE profiles SET role = 'admin' WHERE email = 'admin@test.com';
--    UPDATE profiles SET role = 'superadmin' WHERE email = 'superadmin@test.com';
--    UPDATE profiles SET role = 'fleet' WHERE email = 'fleet@test.com';
--    UPDATE profiles SET role = 'client' WHERE email = 'client@test.com';

-- Или используйте Supabase Auth API для создания пользователей программно


