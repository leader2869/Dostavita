-- Миграция 067: Создание таблицы для хранения push-подписок

-- Таблица для хранения push-подписок пользователей
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Включаем RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Политики RLS
-- Пользователи могут создавать и обновлять свои подписки
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Суперадмины могут видеть все подписки
DROP POLICY IF EXISTS "Superadmins can view all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Superadmins can view all push subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (
    public.check_user_role(auth.uid(), 'superadmin')
  );

COMMENT ON TABLE public.push_subscriptions IS 'Хранит push-подписки пользователей для отправки уведомлений о новых заказах';

