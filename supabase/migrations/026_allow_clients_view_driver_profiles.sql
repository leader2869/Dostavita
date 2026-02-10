-- Миграция 026: Разрешаем клиентам видеть профили водителей, которые приняли их заказы

-- Удаляем политику, если она уже существует
DROP POLICY IF EXISTS "Clients can view driver profiles for their orders" ON public.profiles;

-- Политика: Клиенты могут видеть профили водителей, которые приняли их заказы
-- Используем проверку через orders напрямую, чтобы избежать рекурсии
CREATE POLICY "Clients can view driver profiles for their orders"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Есть заказ, где этот водитель является исполнителем и заказ принадлежит текущему пользователю
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.executor_user_id = profiles.id
        AND (o.customer_id = auth.uid() OR o.client_id = auth.uid())
    )
  );

