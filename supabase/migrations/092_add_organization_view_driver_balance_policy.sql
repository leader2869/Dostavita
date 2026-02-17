-- Миграция 092: Добавление RLS политики для организаций - просмотр балансов своих водителей
-- Организации должны видеть балансы водителей, которые к ним привязаны

-- Добавляем политику для организаций: они могут видеть балансы своих водителей
CREATE POLICY "Organizations can view their drivers' balances"
  ON public.balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = balances.user_id
        AND p.role = 'driver'
        AND p.organization_id = auth.uid()
    )
  );

-- Комментарий к политике
COMMENT ON POLICY "Organizations can view their drivers' balances" ON public.balances IS 
  'Позволяет организациям видеть балансы водителей, которые к ним привязаны';

