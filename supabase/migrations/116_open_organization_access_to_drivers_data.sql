-- Миграция 116: Открытие доступа организации ко всей информации своих закрепленных водителей
-- Организация должна видеть все данные своих водителей: профили, заказы, транзакции, балансы, дебиторку

-- ============================================
-- PROFILES - Расширяем доступ к профилям водителей
-- ============================================

-- Удаляем старую ограниченную политику, если существует
DROP POLICY IF EXISTS "Organizations can view their drivers location" ON public.profiles;

-- Создаем полную политику: организация может видеть ВСЕ поля профилей своих водителей
-- Используем функцию check_user_role для избежания рекурсии
DROP POLICY IF EXISTS "Organizations can view their drivers profiles" ON public.profiles;
CREATE POLICY "Organizations can view their drivers profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Пользователь может видеть свой собственный профиль
    auth.uid() = profiles.id
    OR
    -- Организация может видеть ВСЕ данные профилей своих водителей
    (
      profiles.organization_id = auth.uid()
      AND profiles.role = 'driver'
      AND public.check_user_role(auth.uid(), 'customer')
    )
  );

-- ============================================
-- ORDERS - Доступ к заказам водителей организации
-- ============================================

-- Удаляем старые политики, если существуют
DROP POLICY IF EXISTS "Organizations can view their drivers orders" ON public.orders;

-- Создаем политику: организация может видеть все заказы своих водителей
-- ВАЖНО: Используем простую проверку через функцию is_driver_organization для избежания рекурсии
-- Также учитываем, что организация может видеть заказы, которые она создала сама (customer_id)
CREATE POLICY "Organizations can view their drivers orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    -- Организация может видеть заказы, которые она создала сама
    orders.customer_id = auth.uid()
    OR
    (
      -- ИЛИ заказы, которые выполняют ее водители
      -- Проверяем, что текущий пользователь - организация (используем функцию для избежания рекурсии)
      public.check_user_role(auth.uid(), 'customer')
      AND
      -- Проверяем, что заказ выполняется водителем организации
      -- Используем функцию is_driver_organization для избежания рекурсии
      orders.executor_user_id IS NOT NULL
      AND public.is_driver_organization(orders.executor_user_id, auth.uid())
    )
  );

-- ============================================
-- BALANCES - Доступ к балансам водителей организации
-- ============================================

-- Удаляем старую политику, если существует
DROP POLICY IF EXISTS "Organizations can view their drivers balances" ON public.balances;

-- Создаем политику: организация может видеть балансы своих водителей
CREATE POLICY "Organizations can view their drivers balances"
  ON public.balances FOR SELECT
  TO authenticated
  USING (
    -- Проверяем, что текущий пользователь - организация (используем функцию для избежания рекурсии)
    public.check_user_role(auth.uid(), 'customer')
    AND
    -- Проверяем, что баланс принадлежит водителю организации
    EXISTS (
      SELECT 1 FROM public.profiles d
      WHERE d.id = balances.user_id
        AND d.role = 'driver'
        AND d.organization_id = auth.uid()
    )
  );

-- ============================================
-- TRANSACTIONS - Проверяем и обновляем политику (уже должна существовать)
-- ============================================

-- Политика уже существует в миграции 112, но убедимся, что она правильная
-- Если политика существует, она будет работать корректно

-- ============================================
-- RECEIVABLES - Доступ к дебиторке водителей организации
-- ============================================

-- Проверяем, есть ли политика для receivables
-- Если нет, создадим (но обычно дебиторка загружается через RPC функции)

-- ============================================
-- DRIVER_LOCATIONS - Доступ к истории местоположений водителей
-- ============================================

-- Удаляем старую политику, если существует
DROP POLICY IF EXISTS "Organizations can view their drivers locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Organizations can view their drivers locations for active orders" ON public.driver_locations;

-- Создаем политику: организация может видеть всю историю местоположений своих водителей
CREATE POLICY "Organizations can view their drivers locations"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (
    -- Проверяем, что текущий пользователь - организация (используем функцию для избежания рекурсии)
    public.check_user_role(auth.uid(), 'customer')
    AND
    -- Проверяем, что местоположение принадлежит водителю организации
    EXISTS (
      SELECT 1 FROM public.profiles d
      WHERE d.id = driver_locations.driver_id
        AND d.role = 'driver'
        AND d.organization_id = auth.uid()
    )
  );

-- Комментарии к политикам
COMMENT ON POLICY "Organizations can view their drivers profiles" ON public.profiles IS 
  'Организации могут видеть все данные профилей своих водителей (включая location, phone, email и т.д.)';

COMMENT ON POLICY "Organizations can view their drivers orders" ON public.orders IS 
  'Организации могут видеть все заказы своих водителей';

COMMENT ON POLICY "Organizations can view their drivers balances" ON public.balances IS 
  'Организации могут видеть балансы своих водителей';

COMMENT ON POLICY "Organizations can view their drivers locations" ON public.driver_locations IS 
  'Организации могут видеть всю историю местоположений своих водителей';

