-- Миграция 068: Обновление схемы таблицы push_subscriptions
-- Заменяем JSONB поле subscription на отдельные поля для endpoint, p256dh_key, auth_key

-- Шаг 1: Добавляем новые поля как nullable сначала
ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS endpoint TEXT;

ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS p256dh_key TEXT;

ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS auth_key TEXT;

-- Шаг 2: Если есть старое поле subscription с данными, извлекаем их
DO $$
DECLARE
  sub_record RECORD;
BEGIN
  -- Проверяем, существует ли поле subscription
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'push_subscriptions' 
    AND column_name = 'subscription'
  ) THEN
    -- Извлекаем данные из JSONB поля subscription
    FOR sub_record IN 
      SELECT 
        id,
        subscription->>'endpoint' as endpoint_val,
        subscription->'keys'->>'p256dh' as p256dh_val,
        subscription->'keys'->>'auth' as auth_val
      FROM public.push_subscriptions
      WHERE subscription IS NOT NULL
        AND (endpoint IS NULL OR p256dh_key IS NULL OR auth_key IS NULL)
    LOOP
      -- Обновляем записи с извлеченными данными
      UPDATE public.push_subscriptions
      SET 
        endpoint = sub_record.endpoint_val,
        p256dh_key = sub_record.p256dh_val,
        auth_key = sub_record.auth_val
      WHERE id = sub_record.id
        AND (endpoint IS NULL OR p256dh_key IS NULL OR auth_key IS NULL);
    END LOOP;
  END IF;
END $$;

-- Шаг 3: Удаляем записи, у которых нет endpoint (невалидные подписки)
DELETE FROM public.push_subscriptions
WHERE endpoint IS NULL OR p256dh_key IS NULL OR auth_key IS NULL;

-- Шаг 4: Теперь можем добавить ограничения NOT NULL
ALTER TABLE public.push_subscriptions
ALTER COLUMN endpoint SET NOT NULL;

ALTER TABLE public.push_subscriptions
ALTER COLUMN p256dh_key SET NOT NULL;

ALTER TABLE public.push_subscriptions
ALTER COLUMN auth_key SET NOT NULL;

-- Шаг 5: Удаляем старое поле subscription, если оно существует
ALTER TABLE public.push_subscriptions
DROP COLUMN IF EXISTS subscription;

-- Шаг 6: Удаляем старый уникальный индекс на user_id (теперь может быть несколько подписок на пользователя)
DROP INDEX IF EXISTS idx_push_subscriptions_user_id_unique;

-- Шаг 7: Создаем новый уникальный индекс на endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Шаг 8: Создаем индекс на user_id для быстрого поиска подписок пользователя
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Шаг 9: Добавляем комментарии
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'Уникальный URL для отправки push-уведомлений';
COMMENT ON COLUMN public.push_subscriptions.p256dh_key IS 'Публичный ключ для шифрования push-сообщений';
COMMENT ON COLUMN public.push_subscriptions.auth_key IS 'Аутентификационный секрет для push-сообщений';

