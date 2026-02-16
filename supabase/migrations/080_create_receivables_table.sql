-- Миграция 080: Создание таблицы дебиторки (receivables)
-- Эта таблица хранит информацию о неоплаченных заказах

CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  debtor_type TEXT NOT NULL CHECK (debtor_type IN ('sender', 'recipient')),
  debtor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'BYN',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_receivables_order_id ON public.receivables(order_id);
CREATE INDEX IF NOT EXISTS idx_receivables_debtor_user_id ON public.receivables(debtor_user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_created_at ON public.receivables(created_at DESC);

-- Комментарии
COMMENT ON TABLE public.receivables IS 'Таблица дебиторки - неоплаченные заказы';
COMMENT ON COLUMN public.receivables.debtor_type IS 'Тип должника: sender (отправитель) или recipient (получатель)';
COMMENT ON COLUMN public.receivables.debtor_user_id IS 'ID пользователя-должника (если известен)';
COMMENT ON COLUMN public.receivables.status IS 'Статус задолженности: unpaid (не оплачено), paid (оплачено), cancelled (отменено)';

-- RLS политики
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

-- Водители могут видеть дебиторку по своим заказам
CREATE POLICY "Drivers can view receivables for their orders"
  ON public.receivables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = receivables.order_id
        AND o.executor_user_id = auth.uid()
    )
  );

-- Организации могут видеть дебиторку по заказам своих водителей
-- Используем organization_id из profiles
CREATE POLICY "Organizations can view receivables for their drivers' orders"
  ON public.receivables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      INNER JOIN public.profiles d ON o.executor_user_id = d.id
      WHERE o.id = receivables.order_id
        AND d.organization_id = auth.uid()
    )
  );

-- Суперадмины могут видеть все
CREATE POLICY "Superadmins can view all receivables"
  ON public.receivables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'superadmin'
    )
  );

