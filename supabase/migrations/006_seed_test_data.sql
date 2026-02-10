-- Миграция 006: Создание тестовых данных
-- ВАЖНО: Сначала создайте пользователей через /register или Supabase Auth API
-- Затем обновите их роли в таблице profiles

-- Пример SQL для обновления ролей (выполните после создания пользователей):
-- 
-- UPDATE profiles SET role = 'customer' WHERE email = 'customer@test.com';
-- UPDATE profiles SET role = 'driver' WHERE email = 'driver@test.com';
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@test.com';
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'superadmin@test.com';
-- UPDATE profiles SET role = 'fleet' WHERE email = 'fleet@test.com';
-- UPDATE profiles SET role = 'client' WHERE email = 'client@test.com';

-- Создание профиля водителя (если пользователь уже создан)
-- Замените USER_ID на реальный ID пользователя из auth.users
-- 
-- INSERT INTO public.drivers (user_id, vehicle_type, license_number)
-- VALUES (
--   (SELECT id FROM public.profiles WHERE email = 'driver@test.com'),
--   'car',
--   'AB1234567'
-- )
-- ON CONFLICT (user_id) DO NOTHING;

