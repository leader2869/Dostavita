-- Миграция 049: Исправление доступа клиентов к профилю водителя для активных заказов

-- Убеждаемся, что политика "Clients can view driver profiles for their orders" существует и работает корректно
DROP POLICY IF EXISTS "Clients can view driver profiles for their orders" ON public.profiles;

CREATE POLICY "Clients can view driver profiles for their orders"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
    OR
    -- Клиент может видеть профиль водителя, если есть заказ,
    -- где этот водитель является исполнителем и заказ принадлежит текущему пользователю
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.executor_user_id = profiles.id
        AND (o.client_id = auth.uid() OR o.customer_id = auth.uid())
        AND o.status IN ('courier_coming', 'courier_delivering', 'completed')
    )
  );

-- Комментарий
COMMENT ON POLICY "Clients can view driver profiles for their orders" ON public.profiles IS 
  'Клиенты могут видеть профили водителей, которые выполняют или выполнили их заказы';

