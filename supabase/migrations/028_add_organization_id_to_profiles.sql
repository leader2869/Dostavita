-- Миграция 028: Добавление связи водителей с организациями

-- Добавляем поле organization_id в profiles для связи водителей с организациями
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска водителей организации
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- Комментарий к полю
COMMENT ON COLUMN public.profiles.organization_id IS 'ID организации, к которой привязан водитель (для роли driver)';

