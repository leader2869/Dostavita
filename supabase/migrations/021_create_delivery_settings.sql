-- Миграция 021: Создание таблицы настроек доставки

-- Таблица настроек доставки
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value INTEGER NOT NULL, -- Время в минутах
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Вставляем настройки по умолчанию
INSERT INTO public.delivery_settings (setting_key, setting_value, description) VALUES
  ('max_searching_courier_minutes', 5, 'Максимальное время поиска курьера (в минутах)'),
  ('max_courier_coming_minutes', 30, 'Максимальное время до прибытия курьера (в минутах)'),
  ('max_courier_delivering_minutes', 60, 'Максимальное время доставки заказа (в минутах)')
ON CONFLICT (setting_key) DO NOTHING;

-- Индекс для быстрого поиска
CREATE INDEX idx_delivery_settings_key ON public.delivery_settings(setting_key);

-- Включаем RLS
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

-- Только суперадмины могут видеть и изменять настройки
CREATE POLICY "Superadmins can view delivery settings"
  ON public.delivery_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can update delivery settings"
  ON public.delivery_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can insert delivery settings"
  ON public.delivery_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

