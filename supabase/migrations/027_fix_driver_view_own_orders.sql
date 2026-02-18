-- Миграция 027: Исправление RLS политики для водителей - видеть свои заказы
-- Проблема: после принятия заказа водитель не может его прочитать из-за RLS

-- Удаляем старую политику, если она существует
DROP POLICY IF EXISTS "Drivers can view own orders" ON public.orders;

-- Создаем новую политику: водители могут видеть свои заказы
-- где executor_user_id = их ID (независимо от статуса)
CREATE POLICY "Drivers can view own orders"
  ON public.orders FOR SELECT
  USING (
    executor_user_id = auth.uid()
  );

-- Также убедимся, что водители могут видеть заказы со статусом searching_courier
-- (эта политика уже должна существовать из миграции 019, но проверим)
DROP POLICY IF EXISTS "Drivers can view available orders" ON public.orders;

CREATE POLICY "Drivers can view available orders"
  ON public.orders FOR SELECT
  USING (
    status = 'searching_courier'
  );




