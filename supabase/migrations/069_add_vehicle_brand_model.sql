-- Миграция 069: Добавление полей марки и модели транспорта водителя

-- Добавляем колонки с маркой и моделью транспорта в profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_brand TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT;

-- Комментарии к полям
COMMENT ON COLUMN public.profiles.vehicle_brand IS 'Марка транспорта водителя (например, Toyota, BMW, Honda)';
COMMENT ON COLUMN public.profiles.vehicle_model IS 'Модель транспорта водителя (например, Camry, X5, CBR600)';

