-- Миграция 091: Создание баланса для организаций и функции сдачи кассы водителем
-- Водитель может сдать свой баланс (кассу) организации

-- 1. Убеждаемся, что у всех организаций есть баланс
-- Создаем балансы для организаций, у которых их еще нет
INSERT INTO public.balances (user_id, amount, currency, updated_at)
SELECT 
  p.id,
  0.00,
  'BYN',
  NOW()
FROM public.profiles p
WHERE p.role = 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM public.balances b WHERE b.user_id = p.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- 2. Расширяем таблицу transactions для поддержки переводов между пользователями
-- Добавляем поле related_user_id для отслеживания переводов (от кого/кому)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Комментарий к полю
COMMENT ON COLUMN public.transactions.related_user_id IS 
  'ID связанного пользователя (для переводов: от кого/кому переведены средства)';

-- 3. Расширяем тип транзакции для поддержки переводов
-- Добавляем новый тип 'transfer' для переводов между пользователями
-- Сначала удаляем CHECK constraint, если он существует
DO $$
BEGIN
  -- Проверяем, есть ли CHECK constraint на type
  IF EXISTS (
    SELECT 1 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'transactions' 
      AND column_name = 'type'
      AND constraint_name LIKE '%type%check%'
  ) THEN
    -- Удаляем старый constraint
    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
  END IF;
  
  -- Добавляем новый constraint с типом 'transfer'
  ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('credit', 'debit', 'transfer'));
END $$;

-- 4. Создаем функцию для сдачи кассы водителем организации
CREATE OR REPLACE FUNCTION public.deposit_cash_to_organization(
  driver_user_id UUID,
  amount_to_deposit DECIMAL(10, 2)
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
  
  -- Проверяем, что организация существует
  SELECT role INTO org_role
  FROM public.profiles
  WHERE id = driver_org_id;
  
  IF NOT FOUND OR org_role != 'customer' THEN
    RAISE EXCEPTION 'Организация не найдена';
  END IF;
  
  -- Проверяем сумму перевода
  IF amount_to_deposit <= 0 THEN
    RAISE EXCEPTION 'Сумма перевода должна быть больше нуля';
  END IF;
  
  -- Получаем текущий баланс водителя
  SELECT COALESCE(amount, 0) INTO driver_balance
  FROM public.balances
  WHERE user_id = driver_user_id;
  
  -- Проверяем, что у водителя достаточно средств
  IF driver_balance < amount_to_deposit THEN
    RAISE EXCEPTION 'Недостаточно средств на балансе. Доступно: %', driver_balance;
  END IF;
  
  -- Создаем баланс для организации, если его нет
  INSERT INTO public.balances (user_id, amount, currency, updated_at)
  VALUES (driver_org_id, 0.00, 'BYN', NOW())
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
    amount_to_deposit,
    'debit',
    'Сдача кассы организации',
    driver_org_id,
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
    driver_org_id,
    amount_to_deposit,
    'credit',
    'Получение кассы от водителя',
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
      WHERE user_id = driver_org_id
    ),
    updated_at = NOW()
  WHERE user_id = driver_org_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Ошибка при сдаче кассы: %', SQLERRM;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.deposit_cash_to_organization(UUID, DECIMAL) TO authenticated;

-- Комментарий к функции
COMMENT ON FUNCTION public.deposit_cash_to_organization IS 
  'Функция для сдачи кассы водителем организации. Списывает средства с баланса водителя и зачисляет на баланс организации.';

-- 5. Создаем функцию для получения баланса организации
CREATE OR REPLACE FUNCTION public.get_organization_balance(organization_user_id UUID)
RETURNS TABLE (
  balance_amount DECIMAL(10, 2),
  currency TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_role TEXT;
BEGIN
  -- Проверяем, что пользователь является организацией
  SELECT role INTO org_role
  FROM public.profiles
  WHERE id = organization_user_id;
  
  IF NOT FOUND OR org_role != 'customer' THEN
    RAISE EXCEPTION 'Организация не найдена';
  END IF;
  
  -- Возвращаем баланс организации
  RETURN QUERY
  SELECT 
    COALESCE(b.amount, 0.00) as balance_amount,
    COALESCE(b.currency, 'BYN') as currency,
    COALESCE(b.updated_at, NOW()) as updated_at
  FROM public.balances b
  WHERE b.user_id = organization_user_id;
  
  -- Если баланса нет, возвращаем нулевой баланс
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0.00::DECIMAL(10, 2), 'BYN'::TEXT, NOW()::TIMESTAMPTZ;
  END IF;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_organization_balance(UUID) TO authenticated;

-- Комментарий к функции
COMMENT ON FUNCTION public.get_organization_balance IS 
  'Функция для получения баланса организации';

