-- Миграция 093: Функция для изъятия кассы организацией у водителя
-- Организация может забрать кассу у своего водителя

CREATE OR REPLACE FUNCTION public.withdraw_cash_from_driver(
  organization_user_id UUID,
  driver_user_id UUID,
  amount_to_withdraw DECIMAL(10, 2)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_org_id UUID;
  driver_balance DECIMAL(10, 2);
  driver_role TEXT;
  org_role TEXT;
BEGIN
  -- Проверяем, что вызывающий пользователь является организацией
  SELECT role INTO org_role
  FROM public.profiles
  WHERE id = organization_user_id;
  
  IF NOT FOUND OR org_role != 'customer' THEN
    RAISE EXCEPTION 'Пользователь не является организацией';
  END IF;
  
  -- Проверяем, что водитель существует и привязан к этой организации
  SELECT role, organization_id INTO driver_role, driver_org_id
  FROM public.profiles
  WHERE id = driver_user_id;
  
  IF NOT FOUND OR driver_role != 'driver' THEN
    RAISE EXCEPTION 'Водитель не найден';
  END IF;
  
  IF driver_org_id IS NULL OR driver_org_id != organization_user_id THEN
    RAISE EXCEPTION 'Водитель не привязан к вашей организации';
  END IF;
  
  -- Проверяем сумму перевода
  IF amount_to_withdraw <= 0 THEN
    RAISE EXCEPTION 'Сумма должна быть больше нуля';
  END IF;
  
  -- Получаем текущий баланс водителя
  SELECT COALESCE(amount, 0) INTO driver_balance
  FROM public.balances
  WHERE user_id = driver_user_id;
  
  -- Проверяем, что у водителя достаточно средств
  IF driver_balance < amount_to_withdraw THEN
    RAISE EXCEPTION 'Недостаточно средств на балансе водителя. Доступно: %', driver_balance;
  END IF;
  
  -- Создаем баланс для организации, если его нет
  INSERT INTO public.balances (user_id, amount, currency, updated_at)
  VALUES (organization_user_id, 0.00, 'BYN', NOW())
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
    driver_user_id,
    amount_to_withdraw,
    'debit',
    'Изъятие кассы организацией',
    organization_user_id,
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
    organization_user_id,
    amount_to_withdraw,
    'credit',
    'Получение кассы от водителя (изъятие организацией)',
    driver_user_id,
    NOW()
  );
  
  -- 3. Обновляем баланс водителя (сумма всех credit транзакций минус все debit транзакции)
  UPDATE public.balances
  SET 
    amount = (
      SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
      FROM public.transactions
      WHERE user_id = driver_user_id
    ),
    updated_at = NOW()
  WHERE user_id = driver_user_id;
  
  -- 4. Обновляем баланс организации (сумма всех credit транзакций минус все debit транзакции)
  UPDATE public.balances
  SET 
    amount = (
      SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
      FROM public.transactions
      WHERE user_id = organization_user_id
    ),
    updated_at = NOW()
  WHERE user_id = organization_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Ошибка при изъятии кассы: %', SQLERRM;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.withdraw_cash_from_driver(UUID, UUID, DECIMAL) TO authenticated;

-- Комментарий к функции
COMMENT ON FUNCTION public.withdraw_cash_from_driver IS 
  'Функция для изъятия кассы организацией у водителя. Списывает средства с баланса водителя и зачисляет на баланс организации.';

