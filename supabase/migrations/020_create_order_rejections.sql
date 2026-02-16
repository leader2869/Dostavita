-- Миграция 020: Создание таблицы для хранения отказов водителей от заказов

-- Таблица отказов водителей от заказов
CREATE TABLE IF NOT EXISTS public.order_rejections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, driver_user_id)
);

-- Индекс для быстрого поиска отказов по водителю
CREATE INDEX idx_order_rejections_driver_user_id ON public.order_rejections(driver_user_id);
CREATE INDEX idx_order_rejections_order_id ON public.order_rejections(order_id);

-- Включаем RLS
ALTER TABLE public.order_rejections ENABLE ROW LEVEL SECURITY;

-- Водители могут создавать свои отказы
CREATE POLICY "Drivers can create own rejections"
  ON public.order_rejections FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

-- Водители могут видеть свои отказы
CREATE POLICY "Drivers can view own rejections"
  ON public.order_rejections FOR SELECT
  USING (driver_user_id = auth.uid());



