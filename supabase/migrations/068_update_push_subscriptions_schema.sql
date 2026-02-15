-- Миграция 068: Обновление схемы таблицы push_subscriptions
-- Заменяем JSONB поле subscription на отдельные поля для endpoint, p256dh_key, auth_key

-- Удаляем старое поле subscription, если оно существует
ALTER TABLE public.push_subscriptions
DROP COLUMN IF EXISTS subscription;

-- Добавляем новые поля, если их нет
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS endpoint TEXT NOT NULL UNIQUE;

ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS p256dh_key TEXT NOT NULL;

ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS auth_key TEXT NOT NULL;

-- Удаляем старый уникальный индекс на user_id (теперь может быть несколько подписок на пользователя)
DROP INDEX IF EXISTS idx_push_subscriptions_user_id_unique;

-- Создаем новый уникальный индекс на endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Создаем индекс на user_id для быстрого поиска подписок пользователя
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'Уникальный URL для отправки push-уведомлений';
COMMENT ON COLUMN public.push_subscriptions.p256dh_key IS 'Публичный ключ для шифрования push-сообщений';
COMMENT ON COLUMN public.push_subscriptions.auth_key IS 'Аутентификационный секрет для push-сообщений';

