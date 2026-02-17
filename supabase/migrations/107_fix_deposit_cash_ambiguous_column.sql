-- Миграция 107: Исправление неоднозначности колонки driver_user_id в функции deposit_cash_to_organization
-- Проблема: column reference "driver_user_id" is ambiguous

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
  v_driver_org_id UUID;
  v_driver_balance DECIMAL(10, 2);
  v_driver_role TEXT;
  v_request_id UUID;
BEGIN
  -- Проверяем, что пользователь является водителем
  SELECT role, organization_id INTO v_driver_role, v_driver_org_id
  FROM public.profiles
  WHERE id = deposit_cash_to_organization.driver_user_id;
  
  IF NOT FOUND OR v_driver_role != 'driver' THEN
    RAISE EXCEPTION 'Пользователь не является водителем';
  END IF;
  
  IF v_driver_org_id IS NULL THEN
    RAISE EXCEPTION 'Водитель не привязан к организации';
  END IF;
  
  -- Проверяем сумму
  IF deposit_cash_to_organization.amount_to_deposit <= 0 THEN
    RAISE EXCEPTION 'Сумма должна быть больше нуля';
  END IF;
  
  -- Получаем текущий баланс водителя
  SELECT COALESCE(amount, 0) INTO v_driver_balance
  FROM public.balances
  WHERE user_id = deposit_cash_to_organization.driver_user_id;
  
  -- Проверяем, что у водителя достаточно средств
  IF v_driver_balance < deposit_cash_to_organization.amount_to_deposit THEN
    RAISE EXCEPTION 'Недостаточно средств на балансе. Доступно: %', v_driver_balance;
  END IF;
  
  -- Проверяем, нет ли уже pending запроса от этого водителя
  -- Используем алиас таблицы и явно указываем параметр функции
  IF EXISTS (
    SELECT 1 FROM public.cash_deposit_requests cdr
    WHERE cdr.driver_user_id = deposit_cash_to_organization.driver_user_id
      AND cdr.organization_id = v_driver_org_id
      AND cdr.status = 'pending'
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
    deposit_cash_to_organization.driver_user_id,
    v_driver_org_id,
    deposit_cash_to_organization.amount_to_deposit,
    'BYN',
    'pending'
  )
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_cash_to_organization(UUID, DECIMAL) TO authenticated;

COMMENT ON FUNCTION public.deposit_cash_to_organization(UUID, DECIMAL) IS 
  'Создает запрос на сдачу кассы от водителя организации. Возвращает ID созданного запроса. Деньги остаются на балансе водителя до принятия запроса организацией.';

