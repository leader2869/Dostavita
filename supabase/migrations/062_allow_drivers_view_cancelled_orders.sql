-- Миграция 062: Разрешить водителям видеть отмененные заказы
-- Водители должны видеть отмененные заказы, чтобы иметь возможность их активировать

-- Создаем политику: водители могут видеть отмененные заказы
CREATE POLICY "Drivers can view cancelled orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    status = 'cancelled'
    AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'driver'
    )
  );

COMMENT ON POLICY "Drivers can view cancelled orders" ON public.orders IS 'Позволяет водителям видеть отмененные заказы для возможности их активации';

