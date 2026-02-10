-- Миграция 008: Автоматическое подтверждение email для новых пользователей
-- Этот триггер автоматически подтверждает email при создании нового пользователя

CREATE OR REPLACE FUNCTION auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Автоматически подтверждаем email при создании пользователя
  -- confirmed_at - это generated column, обновляется автоматически на основе email_confirmed_at
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем триггер для автоматического подтверждения email
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
CREATE TRIGGER auto_confirm_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user_email();

-- Также подтверждаем email для всех существующих пользователей
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

