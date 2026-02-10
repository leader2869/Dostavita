-- Миграция 018: Исправление RLS политик для orders - добавление прав для client роли

-- Клиенты могут создавать заказы (где они указаны как customer_id или client_id)
-- Эта политика дополняет существующую "Customers can create orders"
CREATE POLICY "Clients can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    customer_id = auth.uid() OR client_id = auth.uid()
  );

-- Клиенты могут видеть свои заказы (где они указаны как customer_id или client_id)
-- Эта политика дополняет существующую "Customers can view own orders"
CREATE POLICY "Clients can view own orders"
  ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid() OR client_id = auth.uid()
  );

-- Клиенты могут обновлять свои заказы (менять статус, если они создатели)
CREATE POLICY "Clients can update own orders"
  ON public.orders FOR UPDATE
  USING (
    customer_id = auth.uid() OR client_id = auth.uid()
  );

