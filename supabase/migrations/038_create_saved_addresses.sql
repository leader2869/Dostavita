-- Миграция 038: Создание таблицы для сохраненных адресов пользователей

CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL CHECK (address_type IN ('pickup', 'delivery', 'both')),
  label TEXT NOT NULL, -- Название адреса (например, "Дом", "Офис", "Магазин")
  address TEXT NOT NULL, -- Полный адрес
  coordinates GEOGRAPHY(Point, 4326), -- Координаты адреса
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false, -- Адрес по умолчанию
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_saved_addresses_user_id ON public.saved_addresses(user_id);
CREATE INDEX idx_saved_addresses_user_type ON public.saved_addresses(user_id, address_type);
CREATE INDEX idx_saved_addresses_coordinates ON public.saved_addresses USING GIST(coordinates);

-- RLS политики
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

-- Пользователи могут видеть только свои адреса
CREATE POLICY "Users can view their own saved addresses"
  ON public.saved_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Пользователи могут создавать свои адреса
CREATE POLICY "Users can insert their own saved addresses"
  ON public.saved_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Пользователи могут обновлять свои адреса
CREATE POLICY "Users can update their own saved addresses"
  ON public.saved_addresses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Пользователи могут удалять свои адреса
CREATE POLICY "Users can delete their own saved addresses"
  ON public.saved_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- RPC функция для получения сохраненных адресов пользователя
CREATE OR REPLACE FUNCTION public.get_user_saved_addresses(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  address_type TEXT,
  label TEXT,
  address TEXT,
  coordinates GEOGRAPHY(Point, 4326),
  region_id UUID,
  is_default BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.address_type,
    sa.label,
    sa.address,
    sa.coordinates,
    sa.region_id,
    sa.is_default,
    sa.created_at,
    sa.updated_at
  FROM public.saved_addresses sa
  WHERE sa.user_id = user_uuid
  ORDER BY sa.is_default DESC, sa.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_saved_addresses(UUID) TO authenticated;

