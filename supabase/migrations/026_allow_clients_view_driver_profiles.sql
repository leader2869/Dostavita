-- Миграция 026: Разрешаем клиентам видеть профили водителей, которые приняли их заказы

-- Политика: Клиенты могут видеть профили водителей, которые приняли их заказы
CREATE POLICY "Clients can view driver profiles for their orders"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Проверяем, что текущий пользователь - клиент (customer или client)
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
        AND p.role IN ('customer', 'client', 'organization')
    )
    -- И есть заказ, где этот водитель является исполнителем
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.executor_user_id = profiles.id
        AND (o.customer_id = auth.uid() OR o.client_id = auth.uid())
    )
  );

