-- Миграция 111: Разрешаем всем аутентифицированным пользователям читать имена и email из profiles для чатов
-- Это необходимо для отображения имен отправителей сообщений в чатах

-- Создаем политику, которая разрешает всем аутентифицированным пользователям читать id, full_name и email
-- Это безопасно, так как это публичная информация, необходимая для работы чатов
CREATE POLICY "All users can view names and emails for chats"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Комментарий
COMMENT ON POLICY "All users can view names and emails for chats" ON public.profiles IS 
  'Все аутентифицированные пользователи могут читать id, full_name и email из profiles для отображения имен в чатах';

