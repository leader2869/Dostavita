-- Миграция 023: Добавление RLS политики для создания профиля водителя

-- Водители могут создавать свой профиль
CREATE POLICY "Drivers can insert own profile"
  ON public.drivers FOR INSERT
  WITH CHECK (user_id = auth.uid());

