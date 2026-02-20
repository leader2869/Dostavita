# Создание тестовых пользователей

## Способ 1: Через интерфейс приложения (рекомендуется)

1. Запустите приложение: `npm run dev`
2. Откройте http://localhost:3000/register
3. Зарегистрируйте пользователей с разными email:
   - `customer@test.com` - выберите роль "Заказчик"
   - `driver@test.com` - выберите роль "Исполнитель"
   - `admin@test.com` - выберите роль "Заказчик" (потом изменим)
   - `superadmin@test.com` - выберите роль "Заказчик" (потом изменим)
   - `fleet@test.com` - выберите роль "Заказчик" (потом изменим)
   - `client@test.com` - выберите роль "Заказчик" (потом изменим)

4. Пароль для всех: `Test123456!`

5. После регистрации откройте Supabase Dashboard → SQL Editor и выполните:

```sql
-- Обновляем роли
UPDATE profiles SET role = 'customer' WHERE email = 'customer@test.com';
UPDATE profiles SET role = 'driver' WHERE email = 'driver@test.com';
UPDATE profiles SET role = 'admin' WHERE email = 'admin@test.com';
UPDATE profiles SET role = 'superadmin' WHERE email = 'superadmin@test.com';
UPDATE profiles SET role = 'fleet' WHERE email = 'fleet@test.com';
UPDATE profiles SET role = 'client' WHERE email = 'client@test.com';

-- Создаем профиль водителя
INSERT INTO public.drivers (user_id, vehicle_type, license_number)
VALUES (
  (SELECT id FROM public.profiles WHERE email = 'driver@test.com'),
  'car',
  'AB1234567'
)
ON CONFLICT (user_id) DO NOTHING;
```

## Способ 2: Через Supabase Dashboard

1. Откройте Supabase Dashboard → Authentication → Users
2. Нажмите "Add user" → "Create new user"
3. Создайте пользователей с email и паролем
4. Затем выполните SQL из способа 1 для обновления ролей

## Проверка

После создания выполните:

```sql
SELECT email, role, full_name FROM profiles ORDER BY role;
```

Должны быть видны все 6 пользователей с разными ролями.






