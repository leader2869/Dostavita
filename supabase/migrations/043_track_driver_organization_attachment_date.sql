-- Миграция 043: Отслеживание даты привязки водителя к организации и фильтрация заказов
-- ВНИМАНИЕ: Эта миграция требует, чтобы таблица public.profiles уже существовала (миграция 001)

-- Проверяем существование таблицы profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'Таблица public.profiles не существует. Убедитесь, что миграция 001 выполнена.';
  END IF;
END $$;

-- Добавляем поле для отслеживания даты привязки водителя к организации
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS organization_attached_at TIMESTAMPTZ;

-- Комментарий к полю
COMMENT ON COLUMN public.profiles.organization_attached_at IS 'Дата и время привязки водителя к организации. Используется для фильтрации заказов - организация видит только заказы, принятые после этой даты.';

-- Создаем таблицу для истории привязок водителей к организациям
-- Это позволяет отслеживать, к какой организации был привязан водитель, даже после отвязки
CREATE TABLE IF NOT EXISTS public.driver_organization_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detached_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_driver_org_history_driver ON public.driver_organization_history(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_org_history_org ON public.driver_organization_history(organization_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_org_history_active ON public.driver_organization_history(is_active);

-- Комментарии
COMMENT ON TABLE public.driver_organization_history IS 'История привязок водителей к организациям. Позволяет отслеживать заказы водителей даже после отвязки от организации.';
COMMENT ON COLUMN public.driver_organization_history.is_active IS 'true - водитель сейчас привязан к организации, false - отвязан';

-- Обновляем функцию привязки/отвязки водителя к организации
CREATE OR REPLACE FUNCTION public.update_driver_organization(
  driver_user_id UUID,
  organization_user_id UUID,
  action TEXT -- 'attach' или 'detach'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_role TEXT;
  current_org_id UUID;
BEGIN
  -- Проверяем, что пользователь существует и является водителем
  SELECT role, organization_id INTO driver_role, current_org_id
  FROM public.profiles
  WHERE id = driver_user_id;

  IF NOT FOUND OR driver_role != 'driver' THEN
    RETURN FALSE;
  END IF;

  -- Если action = 'attach', привязываем водителя
  IF action = 'attach' THEN
    -- Проверяем, что водитель не привязан к другой организации
    IF current_org_id IS NOT NULL AND current_org_id != organization_user_id THEN
      RETURN FALSE;
    END IF;

    -- Привязываем водителя и устанавливаем дату привязки
    UPDATE public.profiles
    SET 
      organization_id = organization_user_id,
      organization_attached_at = NOW()
    WHERE id = driver_user_id;
    
    -- Добавляем запись в историю привязок
    INSERT INTO public.driver_organization_history (
      driver_user_id,
      organization_user_id,
      attached_at,
      is_active
    ) VALUES (
      driver_user_id,
      organization_user_id,
      NOW(),
      true
    )
    ON CONFLICT DO NOTHING;
    
    RETURN TRUE;
  END IF;

  -- Если action = 'detach', отвязываем водителя
  IF action = 'detach' THEN
    -- Проверяем, что водитель привязан к этой организации
    IF current_org_id != organization_user_id THEN
      RETURN FALSE;
    END IF;

    -- Отвязываем водителя, но НЕ удаляем дату привязки (для истории)
    -- Это позволяет организации видеть заказы, сделанные во время работы водителя в организации
    UPDATE public.profiles
    SET organization_id = NULL
    WHERE id = driver_user_id;
    
    -- Обновляем историю привязок: помечаем как неактивную и устанавливаем дату отвязки
    UPDATE public.driver_organization_history
    SET 
      is_active = false,
      detached_at = NOW()
    WHERE driver_user_id = update_driver_organization.driver_user_id
      AND organization_user_id = update_driver_organization.organization_user_id
      AND is_active = true;
    
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Обновляем функцию получения заказов организации
-- Показываем заказы водителей, которые СЕЙЧАС привязаны к организации
-- И заказы водителей, которые БЫЛИ привязаны к организации (даже если сейчас отвязаны)
-- Но только те заказы, которые были приняты ПОСЛЕ привязки водителя к организации
CREATE OR REPLACE FUNCTION public.get_organization_orders(organization_user_id UUID)
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  customer_id UUID,
  client_id UUID,
  executor_user_id UUID,
  status TEXT,
  pickup_address TEXT,
  delivery_address TEXT,
  item_type TEXT,
  description TEXT,
  final_price DECIMAL(10, 2),
  created_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  driver_full_name TEXT,
  driver_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.customer_id,
    o.client_id,
    o.executor_user_id,
    o.status,
    o.pickup_address,
    o.delivery_address,
    o.item_type,
    o.description,
    o.final_price,
    o.created_at,
    o.accepted_at,
    o.picked_up_at,
    o.completed_at,
    d.full_name as driver_full_name,
    d.phone as driver_phone
  FROM public.orders o
  INNER JOIN public.profiles d ON o.executor_user_id = d.id
  INNER JOIN public.driver_organization_history h ON h.driver_user_id = d.id
    AND h.organization_user_id = organization_user_id
  WHERE d.role = 'driver'
    -- Показываем только заказы, которые были приняты ПОСЛЕ привязки водителя к организации
    -- и ДО отвязки (или если водитель все еще привязан)
    AND o.accepted_at IS NOT NULL
    AND o.accepted_at >= h.attached_at
    AND (h.detached_at IS NULL OR o.accepted_at <= h.detached_at)
  ORDER BY o.created_at DESC;
END;
$$;

-- Обновляем функцию получения финансов организации
-- Учитываем только заказы, принятые после привязки водителя к организации
CREATE OR REPLACE FUNCTION public.get_organization_finances(organization_user_id UUID, start_date TIMESTAMPTZ DEFAULT NULL, end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  driver_id UUID,
  driver_full_name TEXT,
  completed_orders_count BIGINT,
  total_earnings DECIMAL(10, 2),
  balance DECIMAL(10, 2)
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as driver_id,
    d.full_name as driver_full_name,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed') as completed_orders_count,
    COALESCE(SUM(o.final_price) FILTER (WHERE o.status = 'completed'), 0) as total_earnings,
    COALESCE(b.amount, 0) as balance
  FROM public.profiles d
  INNER JOIN public.driver_organization_history h ON h.driver_user_id = d.id
    AND h.organization_user_id = organization_user_id
  LEFT JOIN public.orders o ON o.executor_user_id = d.id
    -- Фильтруем заказы: только те, что были приняты после привязки к организации
    -- и ДО отвязки (или если водитель все еще привязан)
    AND o.accepted_at IS NOT NULL
    AND o.accepted_at >= h.attached_at
    AND (h.detached_at IS NULL OR o.accepted_at <= h.detached_at)
    -- Дополнительные фильтры по датам
    AND (start_date IS NULL OR o.completed_at >= start_date)
    AND (end_date IS NULL OR o.completed_at <= end_date)
  LEFT JOIN public.balances b ON b.user_id = d.id
  WHERE d.role = 'driver'
  GROUP BY d.id, d.full_name, b.amount
  ORDER BY d.full_name;
END;
$$;

-- Создаем триггер для автоматического создания записи в истории при создании водителя с organization_id
CREATE OR REPLACE FUNCTION public.handle_driver_organization_attach()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Если водитель создается с organization_id, создаем запись в истории
  IF NEW.organization_id IS NOT NULL AND NEW.role = 'driver' THEN
    INSERT INTO public.driver_organization_history (
      driver_user_id,
      organization_user_id,
      attached_at,
      is_active
    ) VALUES (
      NEW.id,
      NEW.organization_id,
      COALESCE(NEW.organization_attached_at, NOW()),
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Триггер на INSERT
DROP TRIGGER IF EXISTS trigger_driver_organization_attach ON public.profiles;
CREATE TRIGGER trigger_driver_organization_attach
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_driver_organization_attach();

