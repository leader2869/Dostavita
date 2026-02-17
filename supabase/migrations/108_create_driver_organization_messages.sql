-- Миграция 108: Создание таблицы для сообщений чата между водителем и организацией

-- Создаем таблицу для сообщений чата
CREATE TABLE IF NOT EXISTS public.driver_organization_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL для общего чата, UUID для личного чата
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT, -- Может быть NULL, если отправлено только фото
  photo_url TEXT, -- URL фото в Supabase Storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_driver_org_messages_org_id ON public.driver_organization_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_driver_org_messages_driver_id ON public.driver_organization_messages(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_org_messages_sender_id ON public.driver_organization_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_driver_org_messages_created_at ON public.driver_organization_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_org_messages_org_driver ON public.driver_organization_messages(organization_id, driver_id);

-- Включаем RLS
ALTER TABLE public.driver_organization_messages ENABLE ROW LEVEL SECURITY;

-- Политики RLS
-- 1. Водители могут видеть сообщения своей организации (общий чат) и свои личные сообщения
DROP POLICY IF EXISTS "Drivers can view organization messages" ON public.driver_organization_messages;
CREATE POLICY "Drivers can view organization messages"
  ON public.driver_organization_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'driver'
        AND (
          -- Общий чат: driver_id IS NULL и organization_id совпадает с организацией водителя
          (driver_organization_messages.driver_id IS NULL AND driver_organization_messages.organization_id = p.organization_id)
          OR
          -- Личный чат: driver_id совпадает с ID водителя
          (driver_organization_messages.driver_id = auth.uid())
        )
    )
  );

-- 2. Организации могут видеть общий чат и личные чаты со своими водителями
DROP POLICY IF EXISTS "Organizations can view driver messages" ON public.driver_organization_messages;
CREATE POLICY "Organizations can view driver messages"
  ON public.driver_organization_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'customer'
        AND driver_organization_messages.organization_id = auth.uid()
        AND (
          -- Общий чат
          driver_organization_messages.driver_id IS NULL
          OR
          -- Личный чат: проверяем, что driver_id принадлежит организации
          EXISTS (
            SELECT 1 FROM public.profiles d
            WHERE d.id = driver_organization_messages.driver_id
              AND d.organization_id = auth.uid()
          )
        )
    )
  );

-- 3. Водители могут отправлять сообщения в общий чат своей организации и в свой личный чат
DROP POLICY IF EXISTS "Drivers can send organization messages" ON public.driver_organization_messages;
CREATE POLICY "Drivers can send organization messages"
  ON public.driver_organization_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'driver'
        AND (
          -- Общий чат: driver_id IS NULL и organization_id совпадает с организацией водителя
          (driver_organization_messages.driver_id IS NULL AND driver_organization_messages.organization_id = p.organization_id)
          OR
          -- Личный чат: driver_id совпадает с ID водителя
          (driver_organization_messages.driver_id = auth.uid())
        )
    )
  );

-- 4. Организации могут отправлять сообщения в общий чат и в личные чаты со своими водителями
DROP POLICY IF EXISTS "Organizations can send driver messages" ON public.driver_organization_messages;
CREATE POLICY "Organizations can send driver messages"
  ON public.driver_organization_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'customer'
        AND driver_organization_messages.organization_id = auth.uid()
        AND (
          -- Общий чат
          driver_organization_messages.driver_id IS NULL
          OR
          -- Личный чат: проверяем, что driver_id принадлежит организации
          EXISTS (
            SELECT 1 FROM public.profiles d
            WHERE d.id = driver_organization_messages.driver_id
              AND d.organization_id = auth.uid()
          )
        )
    )
  );

-- 5. Пользователи могут обновлять свои сообщения (для отметки прочитанным)
DROP POLICY IF EXISTS "Users can update their own driver org messages" ON public.driver_organization_messages;
CREATE POLICY "Users can update their own driver org messages"
  ON public.driver_organization_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Комментарии
COMMENT ON TABLE public.driver_organization_messages IS 'Сообщения чата между водителем и организацией (общий и личный чат)';
COMMENT ON COLUMN public.driver_organization_messages.organization_id IS 'ID организации';
COMMENT ON COLUMN public.driver_organization_messages.driver_id IS 'ID водителя (NULL для общего чата, UUID для личного чата)';
COMMENT ON COLUMN public.driver_organization_messages.sender_id IS 'ID отправителя сообщения';
COMMENT ON COLUMN public.driver_organization_messages.message IS 'Текст сообщения (может быть NULL, если отправлено только фото)';
COMMENT ON COLUMN public.driver_organization_messages.photo_url IS 'URL фото в Supabase Storage';
COMMENT ON COLUMN public.driver_organization_messages.read_at IS 'Время прочтения сообщения получателем';

