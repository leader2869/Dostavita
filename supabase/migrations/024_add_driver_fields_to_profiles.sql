-- Миграция 024: Добавление полей водителя в таблицу profiles

-- Добавляем колонки с информацией об автомобиле в profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT;





