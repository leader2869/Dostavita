-- Миграция 007: Подтверждение email для всех пользователей
-- Используйте этот скрипт, если Supabase требует подтверждение email

-- Подтверждаем email для всех пользователей, у которых он не подтвержден
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- Примечание: confirmed_at - это generated column, обновляется автоматически

