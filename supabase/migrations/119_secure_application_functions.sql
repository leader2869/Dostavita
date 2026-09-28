-- Fail closed at both SQL function and table boundaries. No user data is deleted.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.security_actor_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.security_assert(allowed boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN IF auth.uid() IS NULL OR allowed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
END IF; END $$;

CREATE OR REPLACE FUNCTION public.security_owns_driver(driver_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=driver_uuid
 AND role='driver' AND organization_id=auth.uid()) AND public.security_actor_role()='customer' $$;

CREATE OR REPLACE FUNCTION public.security_can_view_profile(profile_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT auth.uid() IS NOT NULL AND (profile_uuid=auth.uid()
 OR public.security_actor_role() IN ('admin','superadmin')
 OR public.security_owns_driver(profile_uuid)
 OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.organization_id=profile_uuid)
 OR EXISTS(SELECT 1 FROM public.orders o WHERE
 (auth.uid() IN(o.customer_id,o.client_id,o.executor_user_id))
 AND o.status IN ('courier_accepted','courier_coming','courier_delivering')
 AND profile_uuid IN(o.customer_id,o.client_id,o.executor_user_id))) $$;

-- Trusted financial functions lock both balances in UUID order, preventing
-- repeated approvals and concurrent transfers from losing updates.
CREATE OR REPLACE FUNCTION public.security_lock_cash(driver_uuid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE org uuid; BEGIN
 SELECT organization_id INTO org FROM public.profiles WHERE id=driver_uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('dostavita:cash:'||driver_uuid::text,0));
 INSERT INTO public.balances(user_id,amount,currency) SELECT id,0,'BYN' FROM public.profiles
 WHERE id IN(driver_uuid,org) ON CONFLICT(user_id) DO NOTHING;
 PERFORM 1 FROM public.balances WHERE user_id IN(driver_uuid,org) ORDER BY user_id FOR UPDATE;
END $$;

-- complete_order
CREATE OR REPLACE FUNCTION public.complete_order(order_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  order_record RECORD;
  driver_user_id UUID;
  existing_receivable_id UUID;
  result JSONB;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='driver' AND EXISTS(SELECT 1 FROM public.orders WHERE id=order_uuid AND executor_user_id=auth.uid()));
  PERFORM 1 FROM public.orders WHERE id=order_uuid FOR UPDATE;

  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_delivering';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Заказ не найден или не в статусе "доставляет"'
    );
  END IF;

  -- Получаем user_id водителя
  driver_user_id := order_record.executor_user_id;

  IF driver_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Водитель не назначен на заказ'
    );
  END IF;

  -- Проверяем статус оплаты
  -- Если is_paid = false или NULL, проверяем наличие записи в receivables
  IF order_record.is_paid = false OR order_record.is_paid IS NULL THEN
    -- Проверяем, есть ли запись в receivables
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;

    -- Если нет записи в receivables, возвращаем ошибку с требованием обработки оплаты
    IF existing_receivable_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'payment_required',
        'message', 'Необходимо обработать оплату перед завершением заказа'
      );
    END IF;
  END IF;

  -- Если оплата обработана (is_paid = true) или есть запись в receivables, завершаем заказ
  UPDATE public.orders
  SET
    status = 'completed',
    completed_at = NOW()
  WHERE id = order_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Заказ успешно завершен'
  );
END;
$function$;

-- start_coming_to_pickup
CREATE OR REPLACE FUNCTION public.start_coming_to_pickup(order_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  order_record RECORD;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='driver' AND EXISTS(SELECT 1 FROM public.orders WHERE id=order_uuid AND executor_user_id=auth.uid()));
  PERFORM 1 FROM public.orders WHERE id=order_uuid FOR UPDATE;

  -- Получаем заказ со статусом courier_accepted
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_accepted';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Обновляем заказ - переводим в статус courier_coming и устанавливаем время начала движения
  UPDATE public.orders
  SET
    status = 'courier_coming',
    started_coming_at = NOW()
  WHERE id = order_uuid;

  RETURN TRUE;
END;
$function$;

-- get_organization_receivables
CREATE OR REPLACE FUNCTION public.get_organization_receivables(organization_user_id uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, order_id uuid, order_number integer, debtor_type text, debtor_user_id uuid, debtor_name text, debtor_organization_name text, debtor_phone text, amount numeric, currency text, status text, created_at timestamp with time zone, driver_full_name text, pickup_address text, delivery_address text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  caller_role TEXT;
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

  -- Проверяем, что вызывающий пользователь является организацией
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF NOT FOUND OR caller_role != 'customer' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только организации могут просматривать дебиторку.';
  END IF;

  -- Проверяем, что organization_user_id совпадает с текущим пользователем
  IF organization_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы можете просматривать только свою дебиторку.';
  END IF;

  RETURN QUERY
  SELECT
    r.id as id,
    r.order_id,
    o.order_number,
    r.debtor_type,
    r.debtor_user_id,
    CASE
      WHEN r.debtor_type = 'sender' AND o.client_id IS NOT NULL THEN
        (SELECT p.full_name FROM public.profiles p WHERE p.id = o.client_id)
      WHEN r.debtor_type = 'recipient' THEN
        'Получатель (не зарегистрирован)'
      ELSE
        'Неизвестно'
    END as debtor_name,
    CASE
      WHEN r.debtor_type = 'sender' AND o.client_id IS NOT NULL THEN
        (SELECT p.organization_name FROM public.profiles p WHERE p.id = o.client_id)
      ELSE
        NULL
    END as debtor_organization_name,
    CASE
      WHEN r.debtor_type = 'sender' THEN o.sender_phone
      WHEN r.debtor_type = 'recipient' THEN o.recipient_phone
      ELSE NULL
    END as debtor_phone,
    r.amount,
    r.currency,
    r.status,
    r.created_at,
    d.full_name as driver_full_name,
    o.pickup_address,
    o.delivery_address
  FROM public.receivables r
  INNER JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles d ON d.id = r.driver_user_id -- Для получения имени водителя
  WHERE r.status = 'unpaid'
    AND r.organization_id = organization_user_id -- Фильтруем напрямую по organization_id в receivables
    AND (start_date IS NULL OR r.created_at >= start_date)
    AND (end_date IS NULL OR r.created_at <= end_date)
  ORDER BY r.created_at DESC;
END;
$function$;

-- get_all_drivers
CREATE OR REPLACE FUNCTION public.get_all_drivers()
 RETURNS TABLE(id uuid, user_id uuid, vehicle_type text, vehicle_number text, license_number text, fleet_id uuid, is_available boolean, rating numeric, total_orders integer, shift_status text, shift_started_at timestamp with time zone, shift_ended_at timestamp with time zone, created_at timestamp with time zone, profile_email text, profile_full_name text, profile_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.vehicle_type,
    d.vehicle_number,
    d.license_number,
    d.fleet_id,
    d.is_available,
    d.rating,
    d.total_orders,
    d.shift_status,
    d.shift_started_at,
    d.shift_ended_at,
    d.created_at,
    p.email as profile_email,
    p.full_name as profile_full_name,
    p.phone as profile_phone
  FROM public.drivers d
  LEFT JOIN public.profiles p ON d.user_id = p.id
  ORDER BY d.created_at DESC;
END;
$function$;

-- get_organization_orders
CREATE OR REPLACE FUNCTION public.get_organization_orders(organization_user_id uuid)
 RETURNS TABLE(id uuid, order_number integer, customer_id uuid, client_id uuid, executor_user_id uuid, status text, pickup_address text, delivery_address text, item_type text, description text, ready_at timestamp with time zone, final_price numeric, created_at timestamp with time zone, accepted_at timestamp with time zone, picked_up_at timestamp with time zone, completed_at timestamp with time zone, driver_full_name text, driver_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

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
    o.ready_at,
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
    AND (
      o.accepted_at IS NULL
      OR o.accepted_at >= h.attached_at
    )
  ORDER BY o.created_at DESC;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Ошибка в get_organization_orders: %', SQLERRM;
    RETURN;
END;
$function$;

-- get_user_saved_addresses
CREATE OR REPLACE FUNCTION public.get_user_saved_addresses(user_uuid uuid)
 RETURNS TABLE(id uuid, address_type text, label text, address text, coordinates text, region_id uuid, region_name text, entrance text, floor text, apartment text, is_default boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(user_uuid=auth.uid());

  RETURN QUERY
  SELECT
    sa.id,
    sa.address_type,
    sa.label,
    sa.address,
    ST_AsText(sa.coordinates) AS coordinates, -- Преобразуем GEOGRAPHY в WKT текст
    sa.region_id,
    r.name AS region_name,
    sa.entrance,
    sa.floor,
    sa.apartment,
    sa.is_default,
    sa.created_at,
    sa.updated_at
  FROM public.saved_addresses sa
  LEFT JOIN public.regions r ON sa.region_id = r.id
  WHERE sa.user_id = user_uuid
  ORDER BY sa.is_default DESC, sa.label ASC;
END;
$function$;

-- get_organization_drivers_with_active_orders
CREATE OR REPLACE FUNCTION public.get_organization_drivers_with_active_orders(organization_user_id uuid)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, vehicle_type text, vehicle_number text, license_number text, current_location point, location_updated_at timestamp with time zone, avatar_url text, created_at timestamp with time zone, active_order_id uuid, active_order_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

  -- Проверяем, что organization_user_id не NULL
  IF organization_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Используем LEFT JOIN вместо INNER JOIN, чтобы вернуть всех водителей
  -- даже если у них нет активных заказов
  RETURN QUERY
  SELECT DISTINCT ON (p.id)
    p.id,
    COALESCE(p.email, '')::TEXT as email,
    COALESCE(p.full_name, '')::TEXT as full_name,
    COALESCE(p.phone, '')::TEXT as phone,
    COALESCE(p.vehicle_type, '')::TEXT as vehicle_type,
    COALESCE(p.vehicle_number, '')::TEXT as vehicle_number,
    COALESCE(p.license_number, '')::TEXT as license_number,
    -- Возвращаем current_location для всех водителей (не только с активными заказами)
    p.current_location,
    -- Возвращаем location_updated_at для всех водителей
    p.location_updated_at,
    COALESCE(p.avatar_url, '')::TEXT as avatar_url,
    p.created_at,
    -- ID активного заказа (если есть)
    o.id as active_order_id,
    -- Статус активного заказа (если есть)
    COALESCE(o.status, '')::TEXT as active_order_status
  FROM public.profiles p
  LEFT JOIN public.orders o ON o.executor_user_id = p.id
    AND o.status IN ('courier_coming', 'courier_delivering')
  WHERE p.organization_id = organization_user_id
    AND p.role = 'driver'
  ORDER BY p.id, o.created_at DESC NULLS LAST;
EXCEPTION
  WHEN OTHERS THEN
    -- В случае ошибки возвращаем пустой результат
    RAISE WARNING 'Ошибка в get_organization_drivers_with_active_orders: %', SQLERRM;
    RETURN;
END;
$function$;

-- get_driver_last_location
CREATE OR REPLACE FUNCTION public.get_driver_last_location(p_driver_id uuid)
 RETURNS TABLE(id uuid, driver_id uuid, order_id uuid, latitude numeric, longitude numeric, accuracy numeric, heading numeric, speed numeric, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() OR public.security_owns_driver(p_driver_id) OR public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    dl.id,
    dl.driver_id,
    dl.order_id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.updated_at
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
  ORDER BY dl.updated_at DESC
  LIMIT 1;
END;
$function$;

-- pickup_order
CREATE OR REPLACE FUNCTION public.pickup_order(order_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  order_record RECORD;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='driver' AND EXISTS(SELECT 1 FROM public.orders WHERE id=order_uuid AND executor_user_id=auth.uid()));
  PERFORM 1 FROM public.orders WHERE id=order_uuid FOR UPDATE;

  -- Получаем заказ
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = order_uuid AND status = 'courier_coming';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Обновляем заказ
  UPDATE public.orders
  SET
    status = 'courier_delivering',
    picked_up_at = NOW(),
    started_delivery_at = NOW()
  WHERE id = order_uuid;

  RETURN TRUE;
END;
$function$;

-- accept_order
CREATE OR REPLACE FUNCTION public.accept_order(order_uuid uuid, driver_user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(driver_user_uuid=auth.uid() AND public.security_actor_role()='driver');

  IF auth.uid() IS NULL OR driver_user_uuid IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver'
      AND vehicle_type IS NOT NULL AND license_number IS NOT NULL
  ) THEN
    RETURN FALSE;
  END IF;
  UPDATE public.orders
  SET executor_user_id = driver_user_uuid, status = 'courier_accepted', accepted_at = NOW()
  WHERE id = order_uuid AND status = 'searching_courier' AND executor_user_id IS NULL;
  RETURN FOUND;
END;
$function$;

-- get_driver_profile_for_organization
CREATE OR REPLACE FUNCTION public.get_driver_profile_for_organization(driver_user_id uuid)
 RETURNS TABLE(id uuid, role text, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(driver_user_id=auth.uid() OR public.security_owns_driver(driver_user_id) OR public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    p.id,
    p.role,
    p.organization_id
  FROM public.profiles p
  WHERE p.id = driver_user_id
    AND p.role = 'driver';
END;
$function$;

-- get_organization_balance
CREATE OR REPLACE FUNCTION public.get_organization_balance(organization_user_id uuid)
 RETURNS TABLE(balance_amount numeric, currency text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  org_role TEXT;
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

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
$function$;

-- create_driver_organization_request
CREATE OR REPLACE FUNCTION public.create_driver_organization_request(driver_user_id uuid, organization_user_id uuid, request_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  request_id UUID;
  driver_role TEXT;
  driver_org_id UUID;
  existing_request_id UUID;
  v_driver_id UUID;
  v_org_id UUID;
BEGIN
  PERFORM public.security_assert(organization_user_id=auth.uid() AND public.security_actor_role()='customer');
  PERFORM 1 FROM public.profiles WHERE id=driver_user_id FOR UPDATE;

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
$function$;

-- get_driver_requests
CREATE OR REPLACE FUNCTION public.get_driver_requests(driver_user_id uuid)
 RETURNS TABLE(id uuid, organization_user_id uuid, organization_name text, organization_email text, message text, status text, created_at timestamp with time zone, responded_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(driver_user_id=auth.uid() OR public.security_owns_driver(driver_user_id) OR public.security_actor_role() IN ('admin','superadmin'));

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
$function$;

-- get_organization_drivers
CREATE OR REPLACE FUNCTION public.get_organization_drivers(organization_user_id uuid)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, vehicle_type text, vehicle_number text, license_number text, current_location point, location_updated_at timestamp with time zone, avatar_url text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.vehicle_type,
    p.vehicle_number,
    p.license_number,
    p.current_location,
    p.location_updated_at,
    p.avatar_url,
    p.created_at
  FROM public.profiles p
  WHERE p.organization_id = organization_user_id
    AND p.role = 'driver'
  ORDER BY p.created_at DESC;
END;
$function$;

-- is_driver_organization
CREATE OR REPLACE FUNCTION public.is_driver_organization(p_driver_id uuid, p_org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_driver_org_id UUID;
BEGIN
  -- Временно отключаем RLS для этого SELECT
  -- Это критически важно для предотвращения рекурсии
  PERFORM set_config('row_security', 'off', true);

  -- Получаем organization_id водителя
  SELECT organization_id INTO v_driver_org_id
  FROM public.profiles
  WHERE id = p_driver_id
    AND role = 'driver';

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);

  -- Проверяем, что organization_id совпадает
  RETURN v_driver_org_id = p_org_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RETURN FALSE;
END;
$function$;

-- get_client_receivables
CREATE OR REPLACE FUNCTION public.get_client_receivables(client_user_id uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, order_id uuid, order_number integer, debtor_type text, amount numeric, currency text, status text, created_at timestamp with time zone, organization_id uuid, organization_name text, driver_full_name text, pickup_address text, delivery_address text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  caller_role TEXT;
BEGIN
  PERFORM public.security_assert(client_user_id=auth.uid() OR public.security_actor_role() IN ('admin','superadmin'));

  -- Проверяем, что вызывающий пользователь является клиентом
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT FOUND OR caller_role != 'client' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только клиенты могут просматривать свою дебиторку.';
  END IF;

  -- Проверяем, что client_user_id совпадает с текущим пользователем
  IF client_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы можете просматривать только свою дебиторку.';
  END IF;

  RETURN QUERY
  SELECT
    r.id as id,
    r.order_id,
    o.order_number,
    r.debtor_type,
    r.amount,
    r.currency,
    r.status,
    r.created_at,
    r.organization_id,
    org.full_name as organization_name,
    d.full_name as driver_full_name,
    o.pickup_address,
    o.delivery_address
  FROM public.receivables r
  INNER JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles d ON d.id = r.driver_user_id
  LEFT JOIN public.profiles org ON org.id = r.organization_id
  WHERE r.status = 'unpaid'
    AND r.debtor_type = 'sender'
    AND r.debtor_user_id = client_user_id
    AND (start_date IS NULL OR r.created_at >= start_date)
    AND (end_date IS NULL OR r.created_at <= end_date)
  ORDER BY r.created_at DESC;
END;
$function$;

-- reject_cash_deposit_request
CREATE OR REPLACE FUNCTION public.reject_cash_deposit_request(request_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  request_record RECORD;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='customer' AND EXISTS(SELECT 1 FROM public.cash_deposit_requests WHERE id=request_id AND organization_id=auth.uid()));
  PERFORM public.security_lock_cash(driver_user_id) FROM public.cash_deposit_requests WHERE id=request_id;
  PERFORM 1 FROM public.cash_deposit_requests WHERE id=request_id FOR UPDATE;

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
$function$;

-- get_all_users
CREATE OR REPLACE FUNCTION public.get_all_users()
 RETURNS TABLE(id uuid, email text, full_name text, phone text, role text, avatar_url text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.role,
    p.avatar_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$function$;

-- search_available_drivers
CREATE OR REPLACE FUNCTION public.search_available_drivers(search_term text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, vehicle_type text, vehicle_number text, license_number text, avatar_url text, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='customer');

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.vehicle_type,
    p.vehicle_number,
    p.license_number,
    p.avatar_url,
    p.organization_id
  FROM public.profiles p
  WHERE p.role = 'driver'
    AND p.organization_id IS NULL
    AND (
      search_term IS NULL OR
      search_term = '' OR
      p.email ILIKE '%' || search_term || '%' OR
      p.full_name ILIKE '%' || search_term || '%' OR
      p.phone ILIKE '%' || search_term || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT 20;
END;
$function$;

-- get_user_profile
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, role text, avatar_url text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(user_id=auth.uid() OR public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.role,
    p.avatar_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = user_id;
END;
$function$;

-- get_all_regions
CREATE OR REPLACE FUNCTION public.get_all_regions()
 RETURNS TABLE(id uuid, name text, base_price numeric, is_active boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(true);

  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.base_price,
    r.is_active,
    r.created_at
  FROM public.regions r
  ORDER BY r.name;
END;
$function$;

-- cancel_cash_deposit_request
CREATE OR REPLACE FUNCTION public.cancel_cash_deposit_request(request_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  request_record RECORD;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='driver' AND EXISTS(SELECT 1 FROM public.cash_deposit_requests WHERE id=request_id AND driver_user_id=auth.uid()));
  PERFORM public.security_lock_cash(driver_user_id) FROM public.cash_deposit_requests WHERE id=request_id;
  PERFORM 1 FROM public.cash_deposit_requests WHERE id=request_id FOR UPDATE;

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
$function$;

-- get_delivery_settings
CREATE OR REPLACE FUNCTION public.get_delivery_settings()
 RETURNS TABLE(id uuid, setting_key text, setting_value integer, description text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(true);

  RETURN QUERY
  SELECT
    ds.id,
    ds.setting_key,
    ds.setting_value,
    ds.description,
    ds.created_at,
    ds.updated_at
  FROM public.delivery_settings ds
  ORDER BY ds.setting_key;
END;
$function$;

-- update_driver_location
CREATE OR REPLACE FUNCTION public.update_driver_location(p_driver_id uuid, p_longitude numeric, p_latitude numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() AND public.security_actor_role()='driver' AND p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180);

  -- Временно отключаем RLS для этого обновления
  -- Это гарантирует, что обновление пройдет без проверки политик
  PERFORM set_config('row_security', 'off', true);

  -- Обновляем местоположение водителя напрямую
  UPDATE public.profiles
  SET
    current_location = POINT(p_longitude, p_latitude),
    location_updated_at = NOW()
  WHERE id = p_driver_id;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);

  -- Проверяем, была ли обновлена хотя бы одна строка
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка обновления местоположения водителя: %', SQLERRM;
    RETURN FALSE;
END;
$function$;

-- get_organization_requests
CREATE OR REPLACE FUNCTION public.get_organization_requests(organization_user_id uuid)
 RETURNS TABLE(id uuid, driver_user_id uuid, driver_name text, driver_email text, driver_phone text, message text, status text, created_at timestamp with time zone, responded_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

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
$function$;

-- get_all_orders_for_admin
CREATE OR REPLACE FUNCTION public.get_all_orders_for_admin(limit_count integer DEFAULT 100)
 RETURNS TABLE(id uuid, customer_id uuid, client_id uuid, driver_id uuid, executor_user_id uuid, status text, visibility text, pickup_address text, pickup_coordinates point, delivery_address text, delivery_coordinates point, description text, weight numeric, volume numeric, item_type text, courier_comment text, base_price numeric, region_id uuid, final_price numeric, is_paid boolean, created_at timestamp with time zone, accepted_at timestamp with time zone, picked_up_at timestamp with time zone, started_delivery_at timestamp with time zone, completed_at timestamp with time zone, cancelled_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    o.id,
    o.customer_id,
    o.client_id,
    o.driver_id,
    o.executor_user_id,
    o.status,
    o.visibility,
    o.pickup_address,
    o.pickup_coordinates,
    o.delivery_address,
    o.delivery_coordinates,
    o.description,
    o.weight,
    o.volume,
    o.item_type,
    o.courier_comment,
    o.base_price,
    o.region_id,
    o.final_price,
    o.is_paid,
    o.created_at,
    o.accepted_at,
    o.picked_up_at,
    o.started_delivery_at,
    o.completed_at,
    o.cancelled_at
  FROM public.orders o
  ORDER BY o.created_at DESC
  LIMIT limit_count;
END;
$function$;

-- update_driver_organization
CREATE OR REPLACE FUNCTION public.update_driver_organization(driver_user_id uuid, organization_user_id uuid, action text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  driver_role TEXT;
  current_org_id UUID;
BEGIN
  PERFORM public.security_assert(organization_user_id=auth.uid() AND public.security_actor_role()='customer' AND action='detach' AND public.security_owns_driver(driver_user_id));
  PERFORM 1 FROM public.profiles WHERE id=driver_user_id FOR UPDATE;

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

    -- Привязываем водителя
    UPDATE public.profiles
    SET organization_id = organization_user_id
    WHERE id = driver_user_id;

    RETURN TRUE;
  END IF;

  -- Если action = 'detach', отвязываем водителя
  IF action = 'detach' THEN
    -- Проверяем, что водитель привязан к этой организации
    IF current_org_id != organization_user_id THEN
      RETURN FALSE;
    END IF;

    -- Отвязываем водителя
    UPDATE public.profiles
    SET organization_id = NULL
    WHERE id = driver_user_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$;

-- check_driver_role
CREATE OR REPLACE FUNCTION public.check_driver_role(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_role TEXT;
BEGIN
  -- Временно отключаем RLS для этого SELECT
  PERFORM set_config('row_security', 'off', true);

  -- Получаем роль пользователя
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);

  -- Проверяем, что роль - водитель
  RETURN v_role = 'driver';
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RETURN FALSE;
END;
$function$;

-- get_organization_finances
CREATE OR REPLACE FUNCTION public.get_organization_finances(organization_user_id uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(driver_id uuid, driver_full_name text, completed_orders_count bigint, total_earnings numeric, balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert((organization_user_id=auth.uid() AND public.security_actor_role()='customer') OR public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    d.id AS driver_id,
    d.full_name AS driver_full_name,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed') AS completed_orders_count,
    COALESCE(SUM(o.final_price) FILTER (WHERE o.status = 'completed'), 0) AS total_earnings,
    COALESCE(b.amount, 0) AS balance
  FROM public.profiles d
  LEFT JOIN public.orders o ON o.executor_user_id = d.id
    AND (start_date IS NULL OR o.completed_at >= start_date)
    AND (end_date IS NULL OR o.completed_at <= end_date)
  LEFT JOIN public.balances b ON b.user_id = d.id
  WHERE d.organization_id = organization_user_id
    AND d.role = 'driver'
  GROUP BY d.id, d.full_name, b.amount
  ORDER BY d.full_name;
END;
$function$;

-- get_driver_organization_info
CREATE OR REPLACE FUNCTION public.get_driver_organization_info(driver_user_id uuid)
 RETURNS TABLE(organization_id uuid, organization_name text, organization_email text, organization_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(driver_user_id=auth.uid() OR public.security_owns_driver(driver_user_id) OR public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    o.id as organization_id,
    o.full_name as organization_name,
    o.email as organization_email,
    o.phone as organization_phone
  FROM public.profiles d
  LEFT JOIN public.profiles o ON d.organization_id = o.id
  WHERE d.id = driver_user_id
    AND d.role = 'driver'
    AND d.organization_id IS NOT NULL;
END;
$function$;

-- get_driver_track_period
CREATE OR REPLACE FUNCTION public.get_driver_track_period(p_driver_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(id uuid, latitude numeric, longitude numeric, accuracy numeric, heading numeric, speed numeric, created_at timestamp with time zone, order_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() OR public.security_owns_driver(p_driver_id) OR public.security_actor_role() IN ('admin','superadmin'));

  -- Отключаем RLS для чтения из driver_locations
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT
    dl.id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.created_at,
    dl.order_id
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND dl.created_at >= p_start_date
    AND dl.created_at <= p_end_date
  ORDER BY dl.created_at ASC;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_track_period: %', SQLERRM;
    RETURN;
END;
$function$;

-- withdraw_cash_from_driver
CREATE OR REPLACE FUNCTION public.withdraw_cash_from_driver(driver_user_id uuid, amount_to_withdraw numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  organization_user_id UUID;
  driver_balance DECIMAL(10, 2);
  calculated_balance DECIMAL(10, 2);
  driver_role TEXT;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='customer' AND public.security_owns_driver(driver_user_id) AND amount_to_withdraw > 0 AND amount_to_withdraw::text NOT IN ('NaN','Infinity','-Infinity'));
  PERFORM public.security_lock_cash(driver_user_id);

  -- Получаем роль текущего пользователя
  SELECT role INTO driver_role FROM public.profiles WHERE id = auth.uid();

  IF driver_role != 'customer' THEN
    RAISE EXCEPTION 'Только организации могут забирать кассу у водителей';
  END IF;

  organization_user_id := auth.uid();

  -- Проверяем, что водитель привязан к этой организации
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = driver_user_id
      AND role = 'driver'
      AND organization_id = organization_user_id
  ) THEN
    RAISE EXCEPTION 'Водитель не привязан к вашей организации';
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

  -- 3. Обновляем баланс водителя (все credit - только debit от сдачи кассы)
  SELECT public.calculate_driver_balance(driver_user_id) INTO calculated_balance;

  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = driver_user_id;

  -- 4. Обновляем баланс организации (все credit - все debit)
  SELECT
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
  INTO calculated_balance
  FROM public.transactions
  WHERE user_id = organization_user_id;

  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = organization_user_id;

  RETURN TRUE;
END;
$function$;

-- get_driver_track_with_time
CREATE OR REPLACE FUNCTION public.get_driver_track_with_time(p_driver_id uuid, p_date date DEFAULT CURRENT_DATE, p_start_time time without time zone DEFAULT NULL::time without time zone, p_end_time time without time zone DEFAULT NULL::time without time zone)
 RETURNS TABLE(id uuid, latitude numeric, longitude numeric, accuracy numeric, heading numeric, speed numeric, created_at timestamp with time zone, order_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() OR public.security_owns_driver(p_driver_id) OR public.security_actor_role() IN ('admin','superadmin'));

  -- Отключаем RLS для чтения из driver_locations
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT
    dl.id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.created_at,
    dl.order_id
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND DATE(dl.created_at) = p_date
    AND (p_start_time IS NULL OR CAST(dl.created_at AS TIME) >= p_start_time)
    AND (p_end_time IS NULL OR CAST(dl.created_at AS TIME) <= p_end_time)
  ORDER BY dl.created_at ASC;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_track_with_time: %', SQLERRM;
    RETURN;
END;
$function$;

-- deposit_cash_to_organization
CREATE OR REPLACE FUNCTION public.deposit_cash_to_organization(driver_user_id uuid, amount_to_deposit numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_driver_org_id UUID;
  v_driver_balance DECIMAL(10, 2);
  v_driver_role TEXT;
  v_request_id UUID;
BEGIN
  PERFORM public.security_assert(driver_user_id=auth.uid() AND public.security_actor_role()='driver' AND amount_to_deposit > 0 AND amount_to_deposit::text NOT IN ('NaN','Infinity','-Infinity'));
  PERFORM public.security_lock_cash(driver_user_id);

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
$function$;

-- get_driver_profile_for_client
CREATE OR REPLACE FUNCTION public.get_driver_profile_for_client(p_driver_id uuid, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, role text, avatar_url text, vehicle_type text, vehicle_brand text, vehicle_model text, vehicle_number text, license_number text, current_location point, location_updated_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_has_access BOOLEAN := FALSE;
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() OR public.security_owns_driver(p_driver_id) OR public.security_actor_role() IN ('admin','superadmin') OR EXISTS(SELECT 1 FROM public.orders o WHERE o.executor_user_id=p_driver_id AND auth.uid() IN(o.client_id,o.customer_id) AND o.status IN ('courier_accepted','courier_coming','courier_delivering') AND (p_order_id IS NULL OR o.id=p_order_id)));

  -- Получаем текущего пользователя
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Получаем роль пользователя
  SELECT p.role INTO v_user_role
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- Проверяем доступ
  -- 1. Водитель может видеть свой профиль
  IF v_user_id = p_driver_id THEN
    v_has_access := TRUE;
  END IF;

  -- 2. Клиент/Организация может видеть профиль водителя для своего активного заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering', 'completed')
    ) INTO v_has_access;
  END IF;

  -- 3. Клиент/Организация может видеть профиль водителя для любого своего активного заказа
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
        AND status IN ('courier_coming', 'courier_delivering')
    ) INTO v_has_access;
  END IF;

  -- 4. Суперадмин может видеть все
  IF NOT v_has_access AND v_user_role = 'superadmin' THEN
    v_has_access := TRUE;
  END IF;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  -- Возвращаем профиль водителя
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.role,
    p.avatar_url,
    p.vehicle_type,
    p.vehicle_brand,
    p.vehicle_model,
    p.vehicle_number,
    p.license_number,
    p.current_location,
    p.location_updated_at,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = p_driver_id;
END;
$function$;

-- get_driver_rejected_orders
CREATE OR REPLACE FUNCTION public.get_driver_rejected_orders(p_driver_user_id uuid)
 RETURNS TABLE(id uuid, order_number integer, pickup_address text, delivery_address text, final_price numeric, item_type text, description text, created_at timestamp with time zone, cancelled_at timestamp with time zone, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(p_driver_user_id=auth.uid() OR public.security_actor_role() IN ('admin','superadmin'));

  -- Временно отключаем RLS для этого SELECT
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT DISTINCT
    o.id,
    o.order_number,
    o.pickup_address,
    o.delivery_address,
    o.final_price,
    o.item_type,
    o.description,
    o.created_at,
    o.cancelled_at,
    o.status
  FROM public.orders o
  INNER JOIN public.order_rejections r ON r.order_id = o.id
  WHERE r.driver_user_id = p_driver_user_id
    AND o.status = 'searching_courier'  -- Только активные заказы, от которых отказались
  ORDER BY r.created_at DESC
  LIMIT 10;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_rejected_orders: %', SQLERRM;
    RETURN;
END;
$function$;

-- get_admin_stats
CREATE OR REPLACE FUNCTION public.get_admin_stats()
 RETURNS TABLE(users_count bigint, drivers_count bigint, orders_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(public.security_actor_role() IN ('admin','superadmin'));

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles)::BIGINT as users_count,
    (SELECT COUNT(*) FROM public.drivers)::BIGINT as drivers_count,
    (SELECT COUNT(*) FROM public.orders)::BIGINT as orders_count;
END;
$function$;

-- is_admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('admin', 'superadmin')
  );
END;
$function$;

-- approve_cash_deposit_request
CREATE OR REPLACE FUNCTION public.approve_cash_deposit_request(request_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  request_record RECORD;
  driver_balance DECIMAL(10, 2);
  calculated_balance DECIMAL(10, 2);
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='customer' AND EXISTS(SELECT 1 FROM public.cash_deposit_requests WHERE id=request_id AND organization_id=auth.uid()));
  PERFORM public.security_lock_cash(driver_user_id) FROM public.cash_deposit_requests WHERE id=request_id;
  PERFORM 1 FROM public.cash_deposit_requests WHERE id=request_id FOR UPDATE;

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

  -- 3. Обновляем баланс водителя (все credit - только debit от сдачи кассы)
  SELECT public.calculate_driver_balance(request_record.driver_user_id) INTO calculated_balance;

  UPDATE public.balances
  SET amount = calculated_balance, updated_at = NOW()
  WHERE user_id = request_record.driver_user_id;

  -- 4. Обновляем баланс организации (все credit - все debit)
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
$function$;

-- get_driver_location_for_order
CREATE OR REPLACE FUNCTION public.get_driver_location_for_order(p_driver_id uuid, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(latitude numeric, longitude numeric, accuracy numeric, heading numeric, speed numeric, updated_at timestamp with time zone, source text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_has_access BOOLEAN := FALSE;
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() OR public.security_owns_driver(p_driver_id) OR public.security_actor_role() IN ('admin','superadmin') OR EXISTS(SELECT 1 FROM public.orders o WHERE o.executor_user_id=p_driver_id AND auth.uid() IN(o.client_id,o.customer_id) AND o.status IN ('courier_accepted','courier_coming','courier_delivering') AND (p_order_id IS NULL OR o.id=p_order_id)));

  -- Получаем текущего пользователя
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Получаем роль пользователя (отключаем RLS для предотвращения рекурсии)
  PERFORM set_config('row_security', 'off', true);
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;
  PERFORM set_config('row_security', 'on', true);

  -- Проверяем доступ
  -- 1. Водитель может видеть свое местоположение
  IF v_user_id = p_driver_id THEN
    v_has_access := TRUE;
  END IF;

  -- 2. Клиент может видеть местоположение водителя для своего заказа
  IF NOT v_has_access AND p_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = p_order_id
        AND executor_user_id = p_driver_id
        AND (client_id = v_user_id OR customer_id = v_user_id)
    ) INTO v_has_access;
  END IF;

  -- 3. Организация может видеть местоположение своих водителей ВСЕГДА (без ограничения на активные заказы)
  IF NOT v_has_access AND v_user_role = 'customer' THEN
    PERFORM set_config('row_security', 'off', true);
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_driver_id
        AND organization_id = v_user_id
        AND role = 'driver'
    ) INTO v_has_access;
    PERFORM set_config('row_security', 'on', true);
  END IF;

  -- 4. Суперадмин может видеть все
  IF NOT v_has_access AND v_user_role = 'superadmin' THEN
    v_has_access := TRUE;
  END IF;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  -- Возвращаем последнее местоположение из driver_locations
  RETURN QUERY
  SELECT
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.updated_at,
    'driver_locations'::TEXT as source
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND (p_order_id IS NULL OR dl.order_id = p_order_id)
  ORDER BY dl.updated_at DESC
  LIMIT 1;

  -- Если нет в driver_locations, возвращаем из profiles
  IF NOT FOUND THEN
    DECLARE
      v_location_text TEXT;
      v_lat DECIMAL;
      v_lon DECIMAL;
    BEGIN
      PERFORM set_config('row_security', 'off', true);
      SELECT current_location::TEXT INTO v_location_text
      FROM public.profiles
      WHERE id = p_driver_id
        AND current_location IS NOT NULL;
      PERFORM set_config('row_security', 'on', true);

      IF v_location_text IS NOT NULL THEN
        -- Парсим формат "(lon,lat)" или "POINT(lon lat)"
        v_location_text := REPLACE(REPLACE(v_location_text, 'POINT(', ''), ')', '');
        v_location_text := REPLACE(REPLACE(v_location_text, '(', ''), ')', '');

        -- Разделяем по пробелу или запятой
        IF POSITION(' ' IN v_location_text) > 0 THEN
          v_lon := SPLIT_PART(v_location_text, ' ', 1)::DECIMAL;
          v_lat := SPLIT_PART(v_location_text, ' ', 2)::DECIMAL;
        ELSIF POSITION(',' IN v_location_text) > 0 THEN
          v_lon := SPLIT_PART(v_location_text, ',', 1)::DECIMAL;
          v_lat := SPLIT_PART(v_location_text, ',', 2)::DECIMAL;
        END IF;

        IF v_lat IS NOT NULL AND v_lon IS NOT NULL THEN
          PERFORM set_config('row_security', 'off', true);
          RETURN QUERY
          SELECT
            v_lat as latitude,
            v_lon as longitude,
            NULL::DECIMAL as accuracy,
            NULL::DECIMAL as heading,
            NULL::DECIMAL as speed,
            (SELECT location_updated_at FROM public.profiles WHERE id = p_driver_id) as updated_at,
            'profiles'::TEXT as source;
          PERFORM set_config('row_security', 'on', true);
        END IF;
      END IF;
    END;
  END IF;
END;
$function$;

-- get_client_transactions
CREATE OR REPLACE FUNCTION public.get_client_transactions(client_user_id uuid, start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, end_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, user_id uuid, order_id uuid, amount numeric, type text, description text, created_at timestamp with time zone, related_user_id uuid, order_number integer, order_final_price numeric, order_customer_id uuid, order_client_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  caller_role TEXT;
BEGIN
  PERFORM public.security_assert(client_user_id=auth.uid() OR public.security_actor_role() IN ('admin','superadmin'));

  -- Проверяем, что вызывающий пользователь является клиентом
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NOT FOUND OR caller_role != 'client' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только клиенты могут просматривать свои транзакции.';
  END IF;

  -- Проверяем, что client_user_id совпадает с текущим пользователем
  IF client_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы можете просматривать только свои транзакции.';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.order_id,
    t.amount,
    t.type,
    t.description,
    t.created_at,
    t.related_user_id,
    o.order_number,
    o.final_price as order_final_price,
    o.customer_id as order_customer_id,
    o.client_id as order_client_id
  FROM public.transactions t
  INNER JOIN public.orders o ON o.id = t.order_id
  WHERE (o.customer_id = client_user_id OR o.client_id = client_user_id)
    AND (start_date IS NULL OR t.created_at >= start_date)
    AND (end_date IS NULL OR t.created_at <= end_date)
  ORDER BY t.created_at DESC;
END;
$function$;

-- get_driver_cancelled_orders
CREATE OR REPLACE FUNCTION public.get_driver_cancelled_orders(p_driver_user_id uuid)
 RETURNS TABLE(id uuid, order_number integer, pickup_address text, delivery_address text, final_price numeric, item_type text, description text, created_at timestamp with time zone, cancelled_at timestamp with time zone, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(coalesce(p_driver_user_id,auth.uid())=auth.uid() OR public.security_actor_role() IN ('admin','superadmin'));

  -- Временно отключаем RLS для этого SELECT
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.pickup_address,
    o.delivery_address,
    o.final_price,
    o.item_type,
    o.description,
    o.created_at,
    o.cancelled_at,
    o.status
  FROM public.orders o
  WHERE o.status = 'cancelled'
    AND o.cancelled_at IS NOT NULL
  ORDER BY o.cancelled_at DESC
  LIMIT 10;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_cancelled_orders: %', SQLERRM;
    RETURN;
END;
$function$;

-- respond_to_organization_request
CREATE OR REPLACE FUNCTION public.respond_to_organization_request(request_id uuid, driver_user_id uuid, response text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  request_record RECORD;
  organization_user_id UUID;
BEGIN
  PERFORM public.security_assert(driver_user_id=auth.uid() AND public.security_actor_role()='driver' AND response IN ('accepted','rejected'));
  PERFORM 1 FROM public.profiles WHERE id=driver_user_id FOR UPDATE;
  PERFORM public.security_assert(response='rejected' OR EXISTS(SELECT 1 FROM public.profiles WHERE id=driver_user_id AND organization_id IS NULL));
  PERFORM 1 FROM public.driver_organization_requests WHERE id=request_id FOR UPDATE;

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
    SET organization_id = organization_user_id
    WHERE profiles.id = respond_to_organization_request.driver_user_id;
  END IF;

  RETURN TRUE;
END;
$function$;

-- check_user_role
CREATE OR REPLACE FUNCTION public.check_user_role(p_user_id uuid, p_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Временно отключаем RLS для этого SELECT
  -- Это критически важно для предотвращения рекурсии
  PERFORM set_config('row_security', 'off', true);

  -- Получаем роль пользователя
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);

  -- Проверяем, что роль совпадает
  RETURN v_user_role = p_role;
EXCEPTION
  WHEN OTHERS THEN
    -- Включаем RLS обратно даже при ошибке
    PERFORM set_config('row_security', 'on', true);
    RETURN FALSE;
END;
$function$;

-- process_order_payment
CREATE OR REPLACE FUNCTION public.process_order_payment(order_uuid uuid, payment_status boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  order_record RECORD;
  driver_user_id UUID;
  driver_org_id UUID;
  debtor_user_id UUID;
  existing_receivable_id UUID;
  recipient_user_id UUID;
  calculated_balance DECIMAL(10, 2);
  transaction_id UUID;
  caller_role TEXT;
BEGIN
  PERFORM public.security_assert(public.security_actor_role() IN ('driver','customer'));
  PERFORM public.security_lock_cash(executor_user_id) FROM public.orders WHERE id=order_uuid;

  RAISE NOTICE 'process_order_payment вызвана: order_uuid = %, payment_status = %',
    order_uuid, payment_status;
  IF order_uuid IS NULL OR payment_status IS NULL THEN
    RAISE EXCEPTION 'order_uuid и payment_status обязательны';
  END IF;
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Пользователь не найден в профилях';
  END IF;
  SELECT * INTO order_record
  FROM public.orders o
  WHERE o.id = order_uuid
    AND (o.status = 'courier_delivering' OR o.status = 'completed')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Заказ не найден или не в правильном статусе. Заказ должен быть в статусе "доставляет" или "завершен"';
  END IF;
  driver_user_id := order_record.executor_user_id;
  IF driver_user_id IS NULL THEN
    RAISE EXCEPTION 'Водитель не назначен на заказ';
  END IF;
  IF caller_role = 'driver' THEN
    IF driver_user_id != auth.uid() THEN
      RAISE EXCEPTION 'Водитель может провести оплату только для своих заказов';
    END IF;
    recipient_user_id := driver_user_id;
  ELSIF caller_role = 'customer' THEN
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    IF driver_org_id IS NULL OR driver_org_id != auth.uid() THEN
      RAISE EXCEPTION 'Организация может провести оплату только для заказов своих водителей';
    END IF;
    recipient_user_id := auth.uid();
  ELSE
    RAISE EXCEPTION 'Только водители и организации могут проводить оплату';
  END IF;
  IF payment_status THEN
    IF order_record.is_paid = true THEN
      DELETE FROM public.receivables WHERE order_id = order_uuid;
      RAISE NOTICE 'Заказ % уже оплачен. Дебиторка удалена, если существовала.', order_uuid;
      RETURN TRUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.transactions WHERE order_id = order_uuid AND type = 'credit') THEN
      RAISE EXCEPTION 'У заказа уже есть начисление: требуется сверка оплаты';
    END IF;
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (recipient_user_id, 0, 'BYN', NOW()) ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM public.balances WHERE user_id = recipient_user_id FOR UPDATE;
    INSERT INTO public.transactions (user_id, order_id, amount, type, description, created_at, related_user_id)
    VALUES (
      recipient_user_id,
      order_uuid,
      order_record.final_price,
      'credit',
      'Начисление за оплату Заказа №' || order_record.order_number::TEXT ||
        CASE
          WHEN recipient_user_id = driver_user_id THEN ' (оплата водителем)'
          ELSE ' (оплата организацией)'
        END,
      COALESCE(order_record.completed_at, NOW()),
      driver_user_id  -- related_user_id всегда указывает на водителя, даже если оплата принята организацией
    )
    RETURNING id INTO transaction_id;
    UPDATE public.orders SET is_paid = true WHERE id = order_uuid;
    IF recipient_user_id = driver_user_id THEN
      SELECT public.calculate_driver_balance(recipient_user_id) INTO calculated_balance;
    ELSE
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)
      INTO calculated_balance
      FROM public.transactions
      WHERE user_id = recipient_user_id;
    END IF;
    INSERT INTO public.balances (user_id, amount, currency, updated_at)
    VALUES (recipient_user_id, calculated_balance, 'BYN', NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET
      amount = calculated_balance,
      updated_at = NOW();
    RAISE NOTICE 'Транзакция создана для пользователя %: %, баланс обновлен: %',
      recipient_user_id, transaction_id, calculated_balance;
    DELETE FROM public.receivables WHERE order_id = order_uuid;
    RAISE NOTICE 'Дебиторка для заказа % удалена после оплаты', order_uuid;
  ELSE
    IF order_record.is_paid IS TRUE THEN
      RAISE EXCEPTION 'Оплаченный заказ нельзя пометить неоплаченным';
    END IF;
    SELECT id INTO existing_receivable_id
    FROM public.receivables
    WHERE order_id = order_uuid
    LIMIT 1;
    IF existing_receivable_id IS NOT NULL THEN
      RAISE NOTICE 'Дебиторка для заказа % уже существует (id: %). Пропускаем создание.', order_uuid, existing_receivable_id;
      RETURN TRUE;
    END IF;
    UPDATE public.orders
    SET is_paid = false
    WHERE orders.id = order_uuid;
    IF order_record.paid_by = 'sender' THEN
      debtor_user_id := order_record.client_id;
    ELSE
      debtor_user_id := NULL;
    END IF;
    SELECT organization_id INTO driver_org_id FROM public.profiles WHERE id = driver_user_id;
    INSERT INTO public.receivables (
      order_id,
      driver_user_id,
      organization_id,
      debtor_type,
      debtor_user_id,
      amount,
      currency,
      status,
      created_at,
      updated_at
    )
    VALUES (
      order_uuid,
      driver_user_id,
      driver_org_id,
      COALESCE(order_record.paid_by, 'sender'),
      debtor_user_id,
      order_record.final_price,
      'BYN',
      'unpaid',
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO NOTHING; -- Защита от дубликатов
    RAISE NOTICE 'Создана дебиторка для заказа %', order_uuid;
  END IF;
  RETURN TRUE;
END;
$function$;

-- withdraw_cash_from_driver
CREATE OR REPLACE FUNCTION public.withdraw_cash_from_driver(organization_user_id uuid, driver_user_id uuid, amount_to_withdraw numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  driver_org_id UUID;
  driver_balance DECIMAL(10, 2);
  driver_role TEXT;
  org_role TEXT;
BEGIN
  PERFORM public.security_assert(public.security_actor_role()='customer' AND public.security_owns_driver(driver_user_id) AND amount_to_withdraw > 0 AND amount_to_withdraw::text NOT IN ('NaN','Infinity','-Infinity') AND organization_user_id=auth.uid());
  PERFORM public.security_lock_cash(driver_user_id);

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
$function$;

-- get_driver_track
CREATE OR REPLACE FUNCTION public.get_driver_track(p_driver_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(id uuid, latitude numeric, longitude numeric, accuracy numeric, heading numeric, speed numeric, created_at timestamp with time zone, order_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(p_driver_id=auth.uid() OR public.security_owns_driver(p_driver_id) OR public.security_actor_role() IN ('admin','superadmin'));

  -- Отключаем RLS для чтения из driver_locations
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT
    dl.id,
    dl.latitude,
    dl.longitude,
    dl.accuracy,
    dl.heading,
    dl.speed,
    dl.created_at,
    dl.order_id
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id
    AND DATE(dl.created_at) = p_date
  ORDER BY dl.created_at ASC;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('row_security', 'on', true);
    RAISE WARNING 'Ошибка в get_driver_track: %', SQLERRM;
    RETURN;
END;
$function$;

-- cancel_organization_request
CREATE OR REPLACE FUNCTION public.cancel_organization_request(request_id uuid, organization_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  PERFORM public.security_assert(organization_user_id=auth.uid() AND public.security_actor_role()='customer');

  -- Отменяем запрос
  UPDATE public.driver_organization_requests
  SET status = 'cancelled'
  WHERE driver_organization_requests.id = request_id
    AND driver_organization_requests.organization_user_id = cancel_organization_request.organization_user_id
    AND driver_organization_requests.status = 'pending';

  RETURN FOUND;
END;
$function$;

DO $acl$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature); END LOOP;
END $acl$;

DO $acl$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('accept_order','approve_cash_deposit_request','cancel_cash_deposit_request','cancel_organization_request','check_driver_role','check_user_role','complete_order','create_driver_organization_request','deposit_cash_to_organization','get_admin_stats','get_all_drivers','get_all_orders_for_admin','get_all_regions','get_all_users','get_client_receivables','get_client_transactions','get_delivery_settings','get_driver_cancelled_orders','get_driver_last_location','get_driver_location_for_order','get_driver_organization_info','get_driver_profile_for_client','get_driver_profile_for_organization','get_driver_rejected_orders','get_driver_requests','get_driver_track','get_driver_track_period','get_driver_track_with_time','get_organization_balance','get_organization_drivers','get_organization_drivers_with_active_orders','get_organization_finances','get_organization_orders','get_organization_receivables','get_organization_requests','get_user_profile','get_user_saved_addresses','is_admin','is_driver_organization','pickup_order','process_order_payment','reject_cash_deposit_request','respond_to_organization_request','search_available_drivers','security_actor_role','security_assert','security_can_view_profile','security_owns_driver','start_coming_to_pickup','update_driver_location','update_driver_organization','withdraw_cash_from_driver') LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END LOOP; END $acl$;

COMMIT;
