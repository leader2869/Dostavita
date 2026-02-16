-- Миграция 074: Создание таблицы для сообщений чата между заказчиком и водителем

-- Создаем таблицу для сообщений чата
CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender_id ON public.order_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON public.order_messages(created_at DESC);

-- Включаем RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Политики RLS
-- 1. Пользователи могут видеть сообщения для заказов, где они являются заказчиком или водителем
DROP POLICY IF EXISTS "Users can view messages for their orders" ON public.order_messages;
CREATE POLICY "Users can view messages for their orders"
  ON public.order_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (
          o.customer_id = auth.uid()
          OR o.client_id = auth.uid()
          OR o.executor_user_id = auth.uid()
        )
    )
  );

-- 2. Пользователи могут отправлять сообщения для заказов, где они являются заказчиком или водителем
DROP POLICY IF EXISTS "Users can send messages for their orders" ON public.order_messages;
CREATE POLICY "Users can send messages for their orders"
  ON public.order_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (
          o.customer_id = auth.uid()
          OR o.client_id = auth.uid()
          OR o.executor_user_id = auth.uid()
        )
    )
  );

-- 3. Пользователи могут обновлять свои сообщения (для отметки прочитанным)
DROP POLICY IF EXISTS "Users can update their own messages" ON public.order_messages;
CREATE POLICY "Users can update their own messages"
  ON public.order_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Комментарии
COMMENT ON TABLE public.order_messages IS 'Сообщения чата между заказчиком и водителем для конкретного заказа';
COMMENT ON COLUMN public.order_messages.order_id IS 'ID заказа, к которому относится сообщение';
COMMENT ON COLUMN public.order_messages.sender_id IS 'ID отправителя сообщения (заказчик или водитель)';
COMMENT ON COLUMN public.order_messages.message IS 'Текст сообщения';
COMMENT ON COLUMN public.order_messages.read_at IS 'Время прочтения сообщения получателем';

