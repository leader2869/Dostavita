-- Business-flow repairs. Existing orders and ledger values are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.accept_order(order_uuid uuid, driver_user_uuid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.security_assert(
  (public.security_actor_role()='driver' AND driver_user_uuid=auth.uid())
  OR public.security_owns_driver(driver_user_uuid));
 -- Hold affiliation stable until assignment and payment ownership are captured.
 PERFORM 1 FROM public.profiles WHERE id=driver_user_uuid AND role='driver'
  AND nullif(btrim(vehicle_type),'') IS NOT NULL AND nullif(btrim(license_number),'') IS NOT NULL FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM public.security_assert(driver_user_uuid=auth.uid() OR public.security_owns_driver(driver_user_uuid));
 UPDATE public.orders SET executor_user_id=driver_user_uuid,status='courier_accepted',accepted_at=now()
 WHERE id=order_uuid AND status='searching_courier' AND executor_user_id IS NULL
 AND (visibility='public' OR (customer_id=auth.uid() AND public.security_actor_role()='customer'));
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.security_validate_order_input() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF nullif(btrim(NEW.pickup_address),'') IS NULL OR nullif(btrim(NEW.delivery_address),'') IS NULL THEN
  RAISE EXCEPTION 'Укажите адрес отправления и доставки' USING ERRCODE='22023'; END IF;
 IF NEW.pickup_coordinates IS NULL OR NEW.delivery_coordinates IS NULL
  OR NOT (NEW.pickup_coordinates[0] BETWEEN -180 AND 180 AND NEW.pickup_coordinates[1] BETWEEN -90 AND 90
      AND NEW.delivery_coordinates[0] BETWEEN -180 AND 180 AND NEW.delivery_coordinates[1] BETWEEN -90 AND 90) THEN
  RAISE EXCEPTION 'Некорректные координаты заказа' USING ERRCODE='22023'; END IF;
 IF (NEW.weight IS NOT NULL AND NOT (NEW.weight>=0 AND NEW.weight<'Infinity'::numeric))
  OR (NEW.volume IS NOT NULL AND NOT (NEW.volume>=0 AND NEW.volume<'Infinity'::numeric)) THEN
  RAISE EXCEPTION 'Вес и объём должны быть неотрицательными конечными числами' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS security_validate_order_input ON public.orders;
CREATE TRIGGER security_validate_order_input BEFORE INSERT OR UPDATE OF pickup_address,delivery_address,pickup_coordinates,delivery_coordinates,weight,volume ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.security_validate_order_input();
REVOKE ALL ON FUNCTION public.security_validate_order_input() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_driver_location(p_latitude numeric,p_longitude numeric,p_accuracy numeric DEFAULT NULL,p_heading numeric DEFAULT NULL,p_speed numeric DEFAULT NULL,p_order_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE point_record public.driver_locations;
BEGIN
 PERFORM public.security_assert(public.security_actor_role()='driver');
 IF p_latitude IS NULL OR p_longitude IS NULL OR NOT(p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180)
  OR (p_accuracy IS NOT NULL AND NOT(p_accuracy>=0 AND p_accuracy<'Infinity'::numeric))
  OR (p_heading IS NOT NULL AND NOT(p_heading>=0 AND p_heading<360))
  OR (p_speed IS NOT NULL AND NOT(p_speed>=0 AND p_speed<'Infinity'::numeric)) THEN
  RAISE EXCEPTION 'Некорректная геопозиция' USING ERRCODE='22023'; END IF;
 IF p_order_id IS NOT NULL THEN
  PERFORM 1 FROM public.orders WHERE id=p_order_id AND executor_user_id=auth.uid() AND status IN ('courier_coming','courier_delivering') FOR SHARE;
  PERFORM public.security_assert(FOUND);
 END IF;
 INSERT INTO public.driver_locations(driver_id,order_id,latitude,longitude,accuracy,heading,speed)
 VALUES(auth.uid(),p_order_id,p_latitude,p_longitude,p_accuracy,p_heading,p_speed) RETURNING * INTO point_record;
 IF public.update_driver_location(auth.uid(),p_longitude,p_latitude) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Не удалось обновить текущую геопозицию'; END IF;
 RETURN to_jsonb(point_record);
END $$;
REVOKE ALL ON FUNCTION public.record_driver_location(numeric,numeric,numeric,numeric,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_driver_location(numeric,numeric,numeric,numeric,numeric,uuid) TO authenticated;
-- The HTTP/RPC path performs the track and profile write atomically.
REVOKE INSERT,UPDATE ON public.driver_locations FROM authenticated;
-- Also reject malformed coordinates inserted through any trusted integration.
ALTER TABLE public.driver_locations DROP CONSTRAINT IF EXISTS driver_location_bounds;
ALTER TABLE public.driver_locations ADD CONSTRAINT driver_location_bounds CHECK(latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) NOT VALID;

CREATE OR REPLACE FUNCTION public.security_guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF NEW.id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.role IS DISTINCT FROM 'client' OR NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'Privileged profile fields are server managed' USING ERRCODE='42501';
   END IF;
  ELSIF (to_jsonb(NEW) - ARRAY['full_name','phone','avatar_url','vehicle_type','vehicle_number','license_number','vehicle_brand','vehicle_model','organization_name','updated_at'])
   IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['full_name','phone','avatar_url','vehicle_type','vehicle_number','license_number','vehicle_brand','vehicle_model','organization_name','updated_at']) THEN
   RAISE EXCEPTION 'Privileged profile fields are server managed' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.security_guard_profile() FROM PUBLIC,anon,authenticated;

-- Schema exports omit triggers in the auth schema. Restore safe profile creation.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
    (SELECT COUNT(*) FROM public.profiles WHERE role='driver')::BIGINT as drivers_count,
    (SELECT COUNT(*) FROM public.orders)::BIGINT as orders_count;
END;
$function$;


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
  INNER JOIN (SELECT rr.order_id, max(rr.created_at) AS created_at FROM public.order_rejections rr WHERE rr.driver_user_id=p_driver_user_id GROUP BY rr.order_id) r ON r.order_id=o.id
  WHERE o.status = 'searching_courier'  -- Только активные заказы, от которых отказались
  ORDER BY r.created_at DESC
  LIMIT 10;

  -- Включаем RLS обратно
  PERFORM set_config('row_security', 'on', true);
END;
$function$;


NOTIFY pgrst, 'reload schema';
COMMIT;
