-- Миграция 062: Разрешить водителям видеть отмененные заказы
-- Водители должны видеть отмененные заказы, чтобы иметь возможность их активировать
-- ВАЖНО: Используем функцию check_driver_role для избежания рекурсии RLS

-- Создаем политику: водители могут видеть отмененные заказы
-- Используем функцию check_driver_role, которая отключает RLS перед SELECT из profiles
CREATE POLICY "Drivers can view cancelled orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    status = 'cancelled'
    AND
    public.check_driver_role(auth.uid())
  );

COMMENT ON POLICY "Drivers can view cancelled orders" ON public.orders IS 'Позволяет водителям видеть отмененные заказы для возможности их активации. Использует check_driver_role для избежания рекурсии RLS.';

