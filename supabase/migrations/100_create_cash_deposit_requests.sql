-- Миграция 100: Создание системы запросов на сдачу кассы
-- Водитель отправляет запрос, организация принимает, только после принятия деньги переводятся

-- Создаем таблицу для запросов на сдачу кассы
CREATE TABLE IF NOT EXISTS public.cash_deposit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'BYN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_cash_deposit_requests_driver ON public.cash_deposit_requests(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_deposit_requests_organization ON public.cash_deposit_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_deposit_requests_status ON public.cash_deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_cash_deposit_requests_created_at ON public.cash_deposit_requests(created_at DESC);

-- RLS политики
ALTER TABLE public.cash_deposit_requests ENABLE ROW LEVEL SECURITY;

-- Водители могут видеть свои запросы
CREATE POLICY "Drivers can view their cash deposit requests"
  ON public.cash_deposit_requests
  FOR SELECT
  USING (driver_user_id = auth.uid());

-- Водители могут создавать запросы
CREATE POLICY "Drivers can create cash deposit requests"
  ON public.cash_deposit_requests
  FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

-- Водители могут отменять свои pending запросы
CREATE POLICY "Drivers can cancel their pending requests"
  ON public.cash_deposit_requests
  FOR UPDATE
  USING (driver_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (driver_user_id = auth.uid() AND status = 'cancelled');

-- Организации могут видеть запросы своих водителей
CREATE POLICY "Organizations can view their drivers' cash deposit requests"
  ON public.cash_deposit_requests
  FOR SELECT
  USING (organization_id = auth.uid());

-- Организации могут принимать/отклонять запросы своих водителей
CREATE POLICY "Organizations can approve/reject cash deposit requests"
  ON public.cash_deposit_requests
  FOR UPDATE
  USING (organization_id = auth.uid() AND status = 'pending')
  WITH CHECK (organization_id = auth.uid() AND status IN ('approved', 'rejected'));

-- Обновляем функцию deposit_cash_to_organization - теперь она создает запрос
DROP FUNCTION IF EXISTS public.deposit_cash_to_organization(UUID, DECIMAL);

CREATE OR REPLACE FUNCTION public.deposit_cash_to_organization(
  driver_user_id UUID,
  amount_to_deposit DECIMAL(10, 2)
)
RETURNS UUID  -- Возвращаем ID созданного запроса
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_org_id UUID;
  driver_balance DECIMAL(10, 2);
  driver_role TEXT;
  request_id UUID;
BEGIN
  -- Проверяем, что пользователь является водителем
  SELECT role, organization_id INTO driver_role, driver_org_id
  FROM public.profiles
  WHERE id = driver_user_id;
  
  IF NOT FOUND OR driver_role != 'driver' THEN
    RAISE EXCEPTION 'Пользователь не является водителем';
  END IF;
  
  IF driver_org_id IS NULL THEN
    RAISE EXCEPTION 'Водитель не привязан к организации';
  END IF;
  
  -- Проверяем сумму
  IF amount_to_deposit <= 0 THEN
    RAISE EXCEPTION 'Сумма должна быть больше нуля';
  END IF;
  
  -- Получаем текущий баланс водителя
  SELECT COALESCE(amount, 0) INTO driver_balance
  FROM public.balances
  WHERE user_id = driver_user_id;
  
  -- Проверяем, что у водителя достаточно средств
  IF driver_balance < amount_to_deposit THEN
    RAISE EXCEPTION 'Недостаточно средств на балансе. Доступно: %', driver_balance;
  END IF;
  
  -- Проверяем, нет ли уже pending запроса от этого водителя
  IF EXISTS (
    SELECT 1 FROM public.cash_deposit_requests
    WHERE driver_user_id = deposit_cash_to_organization.driver_user_id
      AND organization_id = driver_org_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'У вас уже есть активный запрос на сдачу кассы. Дождитесь его обработки.';
  END IF;
  
  -- Создаем запрос на сдачу кассы
  INSERT INTO public.cash_deposit_requests (
    driver_user_id,
    organization_id,
    amount,
    currency,
    status
  )
  VALUES (
    driver_user_id,
    driver_org_id,
    amount_to_deposit,
    'BYN',
    'pending'
  )
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_cash_to_organization(UUID, DECIMAL) TO authenticated;

-- Функция для принятия запроса организацией
CREATE OR REPLACE FUNCTION public.approve_cash_deposit_request(
  request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
  driver_balance DECIMAL(10, 2);
  calculated_balance DECIMAL(10, 2);
BEGIN
  -- Получаем запрос
  SELECT * INTO request_record
  FROM public.cash_deposit_requests
  WHERE id = request_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запрос не найден или уже обработан';
  END IF;
  
  -- Проверяем, что текущий пользователь - организация запроса
  IF request_record.organization_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы не можете принять этот запрос';
  END IF;
  
  -- Проверяем баланс водителя
  SELECT COALESCE(amount, 0) INTO driver_balance
  FROM public.balances
  WHERE user_id = request_record.driver_user_id;
  
  IF driver_balance < request_record.amount THEN
    RAISE EXCEPTION 'У водителя недостаточно средств. Доступно: %', driver_balance;
  END IF;
  
  -- Создаем баланс для организации, если его нет
  INSERT INTO public.balances (user_id, amount, currency, updated_at)
  VALUES (request_record.organization_id, 0.00, 'BYN', NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 1. Списываем средства с баланса водителя (debit транзакция)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    related_user_id,
    created_at
  )
  VALUES (
    request_record.driver_user_id,
    request_record.amount,
    'debit',
    'Сдача кассы организации (запрос №' || request_record.id::TEXT || ')',
    request_record.organization_id,
    NOW()
  );
  
  -- 2. Зачисляем средства на баланс организации (credit транзакция)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    related_user_id,
    created_at
  )
  VALUES (
    request_record.organization_id,
    request_record.amount,
    'credit',
    'Получение кассы от водителя (запрос №' || request_record.id::TEXT || ')',
    request_record.driver_user_id,
    NOW()
  );
  
  -- 3. Обновляем баланс водителя
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE user_id = request_record.driver_user_id;
  
  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = request_record.driver_user_id;
  
  -- 4. Обновляем баланс организации
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE user_id = request_record.organization_id;
  
  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = request_record.organization_id;
  
  -- Обновляем статус запроса
  UPDATE public.cash_deposit_requests
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = auth.uid(),
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_cash_deposit_request(UUID) TO authenticated;

-- Функция для отклонения запроса организацией
CREATE OR REPLACE FUNCTION public.reject_cash_deposit_request(
  request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Получаем запрос
  SELECT * INTO request_record
  FROM public.cash_deposit_requests
  WHERE id = request_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запрос не найден или уже обработан';
  END IF;
  
  -- Проверяем, что текущий пользователь - организация запроса
  IF request_record.organization_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы не можете отклонить этот запрос';
  END IF;
  
  -- Обновляем статус запроса
  UPDATE public.cash_deposit_requests
  SET 
    status = 'rejected',
    rejected_at = NOW(),
    rejected_by = auth.uid(),
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_cash_deposit_request(UUID) TO authenticated;

-- Функция для отмены запроса водителем
CREATE OR REPLACE FUNCTION public.cancel_cash_deposit_request(
  request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Получаем запрос
  SELECT * INTO request_record
  FROM public.cash_deposit_requests
  WHERE id = request_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запрос не найден или уже обработан';
  END IF;
  
  -- Проверяем, что текущий пользователь - водитель запроса
  IF request_record.driver_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы не можете отменить этот запрос';
  END IF;
  
  -- Обновляем статус запроса
  UPDATE public.cash_deposit_requests
  SET 
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_cash_deposit_request(UUID) TO authenticated;

