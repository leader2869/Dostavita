-- Миграция 036: RPC функции для работы с запросами на привязку водителей

-- Функция для создания запроса на привязку водителя
CREATE OR REPLACE FUNCTION public.create_driver_organization_request(
  driver_user_id UUID,
  organization_user_id UUID,
  request_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id UUID;
  driver_role TEXT;
  driver_org_id UUID;
  existing_request_id UUID;
  v_driver_id UUID;
  v_org_id UUID;
BEGIN
  -- Сохраняем параметры в локальные переменные для избежания неоднозначности
  v_driver_id := create_driver_organization_request.driver_user_id;
  v_org_id := create_driver_organization_request.organization_user_id;
  
  -- Проверяем, что водитель существует и имеет роль driver
  SELECT p.role, p.organization_id INTO driver_role, driver_org_id
  FROM public.profiles p
  WHERE p.id = v_driver_id;

  IF NOT FOUND OR driver_role != 'driver' THEN
    RAISE EXCEPTION 'Водитель не найден';
  END IF;

  -- Проверяем, что водитель не привязан к другой организации
  IF driver_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Водитель уже привязан к организации';
  END IF;

  -- Проверяем, нет ли активного запроса
  SELECT r.id INTO existing_request_id
  FROM public.driver_organization_requests r
  WHERE r.driver_user_id = v_driver_id
    AND r.organization_user_id = v_org_id
    AND r.status = 'pending';

  IF existing_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Запрос уже существует';
  END IF;

  -- Создаем запрос
  INSERT INTO public.driver_organization_requests (
    driver_user_id,
    organization_user_id,
    message,
    status
  )
  VALUES (
    v_driver_id,
    v_org_id,
    request_message,
    'pending'
  )
  RETURNING id INTO request_id;

  RETURN request_id;
END;
$$;

-- Функция для получения запросов водителя
CREATE OR REPLACE FUNCTION public.get_driver_requests(driver_user_id UUID)
RETURNS TABLE (
  id UUID,
  organization_user_id UUID,
  organization_name TEXT,
  organization_email TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.organization_user_id,
    o.full_name as organization_name,
    o.email as organization_email,
    r.message,
    r.status,
    r.created_at,
    r.responded_at
  FROM public.driver_organization_requests r
  LEFT JOIN public.profiles o ON r.organization_user_id = o.id
  WHERE r.driver_user_id = get_driver_requests.driver_user_id
    AND r.status = 'pending'
  ORDER BY r.created_at DESC;
END;
$$;

-- Функция для получения запросов организации
CREATE OR REPLACE FUNCTION public.get_organization_requests(organization_user_id UUID)
RETURNS TABLE (
  id UUID,
  driver_user_id UUID,
  driver_name TEXT,
  driver_email TEXT,
  driver_phone TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.driver_user_id,
    d.full_name as driver_name,
    d.email as driver_email,
    d.phone as driver_phone,
    r.message,
    r.status,
    r.created_at,
    r.responded_at
  FROM public.driver_organization_requests r
  LEFT JOIN public.profiles d ON r.driver_user_id = d.id
  WHERE r.organization_user_id = get_organization_requests.organization_user_id
  ORDER BY r.created_at DESC;
END;
$$;

-- Функция для принятия/отклонения запроса водителем
CREATE OR REPLACE FUNCTION public.respond_to_organization_request(
  request_id UUID,
  driver_user_id UUID,
  response TEXT -- 'accepted' или 'rejected'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record RECORD;
  organization_user_id UUID;
BEGIN
  -- Получаем запрос
  SELECT * INTO request_record
  FROM public.driver_organization_requests
  WHERE driver_organization_requests.id = request_id
    AND driver_organization_requests.driver_user_id = respond_to_organization_request.driver_user_id
    AND driver_organization_requests.status = 'pending';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  organization_user_id := request_record.organization_user_id;

  -- Обновляем статус запроса
  UPDATE public.driver_organization_requests
  SET 
    status = response,
    responded_at = NOW()
  WHERE driver_organization_requests.id = request_id;

  -- Если водитель принял запрос, привязываем его к организации
  IF response = 'accepted' THEN
    UPDATE public.profiles
    SET 
      organization_id = organization_user_id,
      organization_attached_at = NOW()
    WHERE profiles.id = respond_to_organization_request.driver_user_id;
    
    -- Добавляем запись в историю привязок
    INSERT INTO public.driver_organization_history (
      driver_user_id,
      organization_user_id,
      attached_at,
      is_active
    ) VALUES (
      respond_to_organization_request.driver_user_id,
      organization_user_id,
      NOW(),
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

-- Функция для отмены запроса организацией
CREATE OR REPLACE FUNCTION public.cancel_organization_request(
  request_id UUID,
  organization_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Отменяем запрос
  UPDATE public.driver_organization_requests
  SET status = 'cancelled'
  WHERE driver_organization_requests.id = request_id
    AND driver_organization_requests.organization_user_id = cancel_organization_request.organization_user_id
    AND driver_organization_requests.status = 'pending';

  RETURN FOUND;
END;
$$;

-- Даем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.create_driver_organization_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_organization_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_organization_request(UUID, UUID) TO authenticated;

