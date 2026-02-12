-- Миграция 029: Добавление отслеживания местоположения водителей

-- Добавляем поля для отслеживания местоположения водителей в profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_location POINT,
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- Создаем индекс для геопоиска
CREATE INDEX IF NOT EXISTS idx_profiles_current_location ON public.profiles USING GIST(current_location);

-- Комментарии к полям
COMMENT ON COLUMN public.profiles.current_location IS 'Текущее местоположение водителя (геокоординаты)';
COMMENT ON COLUMN public.profiles.location_updated_at IS 'Время последнего обновления местоположения';

