-- Миграция 113: Добавление поля organization_name в таблицу profiles для клиентов

-- Добавляем колонку organization_name (необязательное поле для клиентов)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN public.profiles.organization_name IS 'Наименование организации (необязательное поле для клиентов)';


