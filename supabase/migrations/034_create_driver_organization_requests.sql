-- Миграция 034: Таблица запросов на привязку водителей к организациям

-- Создаем таблицу для запросов на привязку водителей
CREATE TABLE IF NOT EXISTS public.driver_organization_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  message TEXT, -- Сообщение от организации (опционально)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ, -- Время ответа водителя
  UNIQUE(driver_user_id, organization_user_id, status) -- Один активный запрос на пару водитель-организация
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_driver_requests_driver_id ON public.driver_organization_requests(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_requests_organization_id ON public.driver_organization_requests(organization_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_requests_status ON public.driver_organization_requests(status);

-- Комментарии
COMMENT ON TABLE public.driver_organization_requests IS 'Запросы организаций на привязку водителей';
COMMENT ON COLUMN public.driver_organization_requests.status IS 'Статус запроса: pending - ожидает ответа, accepted - принят, rejected - отклонен, cancelled - отменен организацией';

