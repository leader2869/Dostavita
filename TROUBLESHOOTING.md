# Решение проблем с входом

## Проблема: Не могу войти после регистрации

### Возможные причины:

1. **Email не подтвержден**
   - Supabase по умолчанию требует подтверждение email
   - Решение: Отключите подтверждение email в Supabase Dashboard:
     - Settings → Authentication → Email Auth
     - Отключите "Enable email confirmations"

2. **Сессия не сохраняется**
   - Проверьте, что cookies работают
   - Убедитесь, что домен правильный

3. **Неправильный пароль**
   - Убедитесь, что используете тот же пароль, что при регистрации

### Проверка:

1. Откройте консоль браузера (F12)
2. Попробуйте войти
3. Посмотрите на ошибки в консоли

### Проверка в Supabase:

1. Откройте Supabase Dashboard → Authentication → Users
2. Найдите вашего пользователя
3. Проверьте:
   - Email подтвержден? (Email Confirmed)
   - Пользователь активен? (Status: Active)

### Быстрое решение:

Если email не подтвержден, выполните в SQL Editor:

```sql
-- Подтвердить email для всех пользователей
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;
```

Или для конкретного пользователя:

```sql
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'ваш_email@example.com';
```

### Альтернатива: Отключить подтверждение email

**Через Supabase Dashboard (рекомендуется):**
1. Откройте Supabase Dashboard
2. Settings → Authentication
3. Email Auth → отключите "Enable email confirmations"
4. Сохраните изменения

**Подробная инструкция:** См. файл `DISABLE_EMAIL_CONFIRMATION.md`

