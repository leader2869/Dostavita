-- Миграция 060: Гарантированное создание таблицы order_rejections
-- Исправляет ошибку "Could not find the table 'public.order_rejections' in the schema cache"

-- Таблица отказов водителей от заказов
CREATE TABLE IF NOT EXISTS public.order_rejections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, driver_user_id)
);

-- Индексы для быстрого поиска отказов
CREATE INDEX IF NOT EXISTS idx_order_rejections_driver_user_id ON public.order_rejections(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_order_rejections_order_id ON public.order_rejections(order_id);

-- Включаем RLS
ALTER TABLE public.order_rejections ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они существуют
DROP POLICY IF EXISTS "Drivers can create own rejections" ON public.order_rejections;
DROP POLICY IF EXISTS "Drivers can view own rejections" ON public.order_rejections;

-- Водители могут создавать свои отказы
CREATE POLICY "Drivers can create own rejections"
  ON public.order_rejections FOR INSERT
  TO authenticated
  WITH CHECK (driver_user_id = auth.uid());

-- Водители могут видеть свои отказы
CREATE POLICY "Drivers can view own rejections"
  ON public.order_rejections FOR SELECT
  TO authenticated
  USING (driver_user_id = auth.uid());

-- Суперадмины могут видеть все отказы
CREATE POLICY IF NOT EXISTS "Superadmins can view all rejections"
  ON public.order_rejections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Комментарии
COMMENT ON TABLE public.order_rejections IS 'Таблица для хранения отказов водителей от заказов';
COMMENT ON COLUMN public.order_rejections.order_id IS 'ID заказа, от которого отказался водитель';
COMMENT ON COLUMN public.order_rejections.driver_user_id IS 'ID водителя, который отказался от заказа';

