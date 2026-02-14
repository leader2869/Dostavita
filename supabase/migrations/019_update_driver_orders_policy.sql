-- Миграция 019: Обновление RLS политики для водителей - видеть все заказы со статусом searching_courier

-- Удаляем старую политику
DROP POLICY IF EXISTS "Drivers can view available orders" ON public.orders;

-- Создаем новую политику: водители видят ВСЕ заказы со статусом searching_courier
CREATE POLICY "Drivers can view available orders"
  ON public.orders FOR SELECT
  USING (
    status = 'searching_courier'
  );


