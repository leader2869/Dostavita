-- Миграция 035: RLS политики для таблицы driver_organization_requests

-- Включаем RLS
ALTER TABLE public.driver_organization_requests ENABLE ROW LEVEL SECURITY;

-- Водители могут видеть свои запросы
CREATE POLICY "Drivers can view own requests"
  ON public.driver_organization_requests FOR SELECT
  TO authenticated
  USING (driver_user_id = auth.uid());

-- Организации могут видеть свои запросы
CREATE POLICY "Organizations can view own requests"
  ON public.driver_organization_requests FOR SELECT
  TO authenticated
  USING (
    organization_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'customer'
    )
  );

-- Организации могут создавать запросы
CREATE POLICY "Organizations can create requests"
  ON public.driver_organization_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'customer'
    )
  );

-- Водители могут обновлять свои запросы (принимать/отклонять)
CREATE POLICY "Drivers can update own requests"
  ON public.driver_organization_requests FOR UPDATE
  TO authenticated
  USING (driver_user_id = auth.uid())
  WITH CHECK (driver_user_id = auth.uid());

-- Организации могут отменять свои запросы
CREATE POLICY "Organizations can cancel own requests"
  ON public.driver_organization_requests FOR UPDATE
  TO authenticated
  USING (
    organization_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'customer'
    )
  )
  WITH CHECK (
    organization_user_id = auth.uid() AND
    status = 'cancelled'
  );

