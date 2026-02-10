-- Миграция 001: Начальная схема базы данных Dostavita

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- ТАБЛИЦЫ
-- ============================================

-- Таблица профилей пользователей
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('customer', 'client', 'driver', 'fleet', 'admin', 'superadmin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица регионов доставки (6 областей Беларуси)
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  base_price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица автопарков (создаем ПЕРЕД drivers, так как drivers ссылается на fleets)
CREATE TABLE public.fleets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_drivers INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Таблица исполнителей (водителей)
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  vehicle_number TEXT,
  license_number TEXT NOT NULL,
  fleet_id UUID REFERENCES public.fleets(id) ON DELETE SET NULL,
  is_available BOOLEAN DEFAULT true,
  current_location POINT,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  total_orders INTEGER DEFAULT 0,
  shift_status TEXT DEFAULT 'offline' CHECK (shift_status IN ('offline', 'online', 'break', 'shift_closed')),
  shift_started_at TIMESTAMPTZ,
  shift_ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Таблица заказов
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  executor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'searching_courier' CHECK (status IN (
    'searching_courier',    -- Ищем курьера
    'courier_coming',       -- Курьер едет к вам
    'courier_delivering',   -- Курьер доставляет заказ
    'completed',            -- Заказ завершен
    'cancelled'             -- Отменен
  )),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'assigned')),
  
  -- Адреса
  pickup_address TEXT NOT NULL,
  pickup_coordinates POINT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_coordinates POINT NOT NULL,
  
  -- Информация о заказе
  description TEXT,
  weight DECIMAL(10, 2),
  volume DECIMAL(10, 2),
  item_type TEXT CHECK (item_type IN ('documents', 'parcel', 'flowers', 'food')),
  courier_comment TEXT,
  
  -- Финансы
  base_price DECIMAL(10, 2) NOT NULL,
  region_id UUID NOT NULL REFERENCES public.regions(id),
  final_price DECIMAL(10, 2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  
  -- Временные метки
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  started_delivery_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Таблица балансов
CREATE TABLE public.balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) DEFAULT 0.00,
  currency TEXT DEFAULT 'BYN',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Таблица транзакций
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ИНДЕКСЫ
-- ============================================

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_drivers_fleet_id ON public.drivers(fleet_id);
CREATE INDEX idx_drivers_is_available ON public.drivers(is_available);
CREATE INDEX idx_drivers_shift_status ON public.drivers(shift_status);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX idx_orders_executor_user_id ON public.orders(executor_user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_visibility ON public.orders(visibility);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_order_id ON public.transactions(order_id);

-- ============================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- ============================================

-- Функция для автоматического создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'client');
  
  INSERT INTO public.balances (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для создания профиля
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON public.balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

