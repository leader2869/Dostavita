-- Миграция 075: Обновление логики отметки сообщений как прочитанных
-- Пользователи могут обновлять read_at для сообщений, которые им адресованы (не от них)

-- Удаляем старую политику
DROP POLICY IF EXISTS "Users can update their own messages" ON public.order_messages;

-- Создаем новую политику: пользователи могут обновлять read_at для сообщений, которые им адресованы
-- (сообщения не от них, но в их заказах)
CREATE POLICY "Users can update read_at for messages addressed to them"
  ON public.order_messages FOR UPDATE
  TO authenticated
  USING (
    sender_id != auth.uid() -- Сообщение не от текущего пользователя
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (
          o.customer_id = auth.uid()
          OR o.client_id = auth.uid()
          OR o.executor_user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    sender_id != auth.uid() -- Сообщение не от текущего пользователя
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

COMMENT ON POLICY "Users can update read_at for messages addressed to them" ON public.order_messages IS 
  'Позволяет пользователям обновлять read_at для сообщений, которые им адресованы (не от них, но в их заказах)';

-- Добавляем индекс для быстрого поиска непрочитанных сообщений
CREATE INDEX IF NOT EXISTS idx_order_messages_read_at ON public.order_messages(order_id, sender_id, read_at) 
WHERE read_at IS NULL;

