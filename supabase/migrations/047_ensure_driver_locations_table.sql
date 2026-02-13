-- Миграция 047: Гарантированное создание таблицы driver_locations
-- Эта миграция убеждается, что таблица driver_locations существует

-- Создаем таблицу, если её нет
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(8, 2), -- Точность в метрах
  heading DECIMAL(5, 2), -- Направление движения в градусах (0-360)
  speed DECIMAL(6, 2), -- Скорость в м/с
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создаем индексы, если их нет
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_order_id ON public.driver_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON public.driver_locations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_updated ON public.driver_locations(driver_id, updated_at DESC);

-- Включаем RLS, если не включен
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть, и создаем новые
DROP POLICY IF EXISTS "Drivers can view their own locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can insert their own locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can update their own locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Clients can view driver location for their orders" ON public.driver_locations;
DROP POLICY IF EXISTS "Organizations can view their drivers locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Superadmin can view all driver locations" ON public.driver_locations;

-- Курьеры могут видеть только свои местоположения
CREATE POLICY "Drivers can view their own locations"
  ON public.driver_locations
  FOR SELECT
  USING (auth.uid() = driver_id);

-- Курьеры могут создавать свои местоположения
CREATE POLICY "Drivers can insert their own locations"
  ON public.driver_locations
  FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

-- Курьеры могут обновлять свои местоположения
CREATE POLICY "Drivers can update their own locations"
  ON public.driver_locations
  FOR UPDATE
  USING (auth.uid() = driver_id);

-- Клиенты могут видеть местоположение курьера для своих заказов
CREATE POLICY "Clients can view driver location for their orders"
  ON public.driver_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = driver_locations.order_id
      AND (orders.client_id = auth.uid() OR orders.customer_id = auth.uid())
    )
  );

-- Организации могут видеть местоположение своих курьеров
CREATE POLICY "Organizations can view their drivers locations"
  ON public.driver_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = driver_locations.driver_id
      AND profiles.organization_id = auth.uid()
    )
  );

-- Суперадмин может видеть все местоположения
CREATE POLICY "Superadmin can view all driver locations"
  ON public.driver_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

-- Создаем функцию для обновления updated_at, если её нет
CREATE OR REPLACE FUNCTION update_driver_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер, если его нет
DROP TRIGGER IF EXISTS update_driver_locations_updated_at ON public.driver_locations;
CREATE TRIGGER update_driver_locations_updated_at
  BEFORE UPDATE ON public.driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_locations_updated_at();

-- Создаем RPC функцию для получения последнего местоположения курьера
CREATE OR REPLACE FUNCTION get_driver_last_location(p_driver_id UUID)
RETURNS TABLE (
  id UUID,
  driver_id UUID,
  order_id UUID,
  latitude DECIMAL,
  longitude DECIMAL,
  accuracy DECIMAL,
  heading DECIMAL,
  speed DECIMAL,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.id,
    dl.driver_id,
    dl.order_id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.updated_at
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
  ORDER BY dl.updated_at DESC
  LIMIT 1;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_driver_last_location(UUID) TO authenticated;

-- Комментарии
COMMENT ON TABLE public.driver_locations IS 'Таблица для отслеживания местоположения водителей при выполнении заказов';
COMMENT ON COLUMN public.driver_locations.driver_id IS 'ID водителя (из profiles)';
COMMENT ON COLUMN public.driver_locations.order_id IS 'ID заказа, при выполнении которого получено местоположение';
COMMENT ON COLUMN public.driver_locations.latitude IS 'Широта';
COMMENT ON COLUMN public.driver_locations.longitude IS 'Долгота';
COMMENT ON COLUMN public.driver_locations.accuracy IS 'Точность определения местоположения в метрах';
COMMENT ON COLUMN public.driver_locations.heading IS 'Направление движения в градусах (0-360)';
COMMENT ON COLUMN public.driver_locations.speed IS 'Скорость движения в м/с';

