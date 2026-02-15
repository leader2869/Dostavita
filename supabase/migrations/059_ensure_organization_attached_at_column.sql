-- Миграция 059: Гарантированное добавление колонки organization_attached_at
-- Исправляет ошибку "Could not find the 'organization_attached_at' column"

-- Добавляем поле для отслеживания даты привязки водителя к организации
-- Используем IF NOT EXISTS для безопасности
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS organization_attached_at TIMESTAMPTZ;

-- Комментарий к полю
COMMENT ON COLUMN public.profiles.organization_attached_at IS 
  'Дата и время привязки водителя к организации. Используется для фильтрации заказов - организация видит только заказы, принятые после этой даты.';

