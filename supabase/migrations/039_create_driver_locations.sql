-- Миграция 039: Создание таблицы для отслеживания местоположения курьеров

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

-- Индексы для быстрого поиска
CREATE INDEX idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX idx_driver_locations_order_id ON public.driver_locations(order_id);
CREATE INDEX idx_driver_locations_updated_at ON public.driver_locations(updated_at DESC);
CREATE INDEX idx_driver_locations_driver_updated ON public.driver_locations(driver_id, updated_at DESC);

-- Геопространственный индекс для поиска по координатам (если используется PostGIS)
-- CREATE INDEX idx_driver_locations_coordinates ON public.driver_locations USING GIST(
--   ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
-- );

-- RLS политики
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

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
      AND profiles.organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
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

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_driver_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_driver_locations_updated_at
  BEFORE UPDATE ON public.driver_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_locations_updated_at();

-- RPC функция для получения последнего местоположения курьера
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

