-- Миграция 004: Row Level Security (RLS) политики

-- Включаем RLS для всех таблиц
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ПОЛИТИКИ ДЛЯ PROFILES
-- ============================================

-- Пользователи могут видеть свой профиль
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Пользователи могут создавать свой профиль (для триггера и ручного создания)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Пользователи могут обновлять свой профиль
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Админы и суперадмины могут видеть все профили
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Суперадмины могут обновлять любые профили
CREATE POLICY "Superadmins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ============================================
-- ПОЛИТИКИ ДЛЯ DRIVERS
-- ============================================

-- Водители могут видеть свой профиль
CREATE POLICY "Drivers can view own profile"
  ON public.drivers FOR SELECT
  USING (user_id = auth.uid());

-- Водители могут обновлять свой профиль
CREATE POLICY "Drivers can update own profile"
  ON public.drivers FOR UPDATE
  USING (user_id = auth.uid());

-- Все могут видеть доступных водителей
CREATE POLICY "Anyone can view available drivers"
  ON public.drivers FOR SELECT
  USING (is_available = true AND shift_status = 'online');

-- Админы могут видеть всех водителей
CREATE POLICY "Admins can view all drivers"
  ON public.drivers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- ПОЛИТИКИ ДЛЯ ORDERS
-- ============================================

-- Заказчики могут видеть свои заказы
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (customer_id = auth.uid());

-- Заказчики могут создавать заказы
CREATE POLICY "Customers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Водители могут видеть доступные заказы (публичные, статус "ищем курьера")
CREATE POLICY "Drivers can view available orders"
  ON public.orders FOR SELECT
  USING (
    status = 'searching_courier' AND visibility = 'public' AND driver_id IS NULL
  );

-- Водители могут видеть свои принятые заказы
CREATE POLICY "Drivers can view own orders"
  ON public.orders FOR SELECT
  USING (
    executor_user_id = auth.uid()
  );

-- Водители могут обновлять свои заказы (менять статус)
CREATE POLICY "Drivers can update own orders"
  ON public.orders FOR UPDATE
  USING (executor_user_id = auth.uid());

-- Админы могут видеть все заказы
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- ПОЛИТИКИ ДЛЯ REGIONS
-- ============================================

-- Все могут видеть активные регионы
CREATE POLICY "Anyone can view active regions"
  ON public.regions FOR SELECT
  USING (is_active = true);

-- Суперадмины могут управлять регионами
CREATE POLICY "Superadmins can manage regions"
  ON public.regions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ============================================
-- ПОЛИТИКИ ДЛЯ BALANCES
-- ============================================

-- Пользователи могут видеть свой баланс
CREATE POLICY "Users can view own balance"
  ON public.balances FOR SELECT
  USING (user_id = auth.uid());

-- Пользователи могут создавать свой баланс (для триггера)
CREATE POLICY "Users can insert own balance"
  ON public.balances FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Админы могут видеть все балансы
CREATE POLICY "Admins can view all balances"
  ON public.balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- ПОЛИТИКИ ДЛЯ TRANSACTIONS
-- ============================================

-- Пользователи могут видеть свои транзакции
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (user_id = auth.uid());

-- Админы могут видеть все транзакции
CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

