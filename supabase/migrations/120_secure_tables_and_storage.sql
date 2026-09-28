-- Table access is independent of API routes: clients can call PostgREST directly.
BEGIN;
DROP POLICY IF EXISTS security_profiles_select ON public.profiles;
DROP POLICY IF EXISTS security_profiles_insert ON public.profiles;
DROP POLICY IF EXISTS security_profiles_update ON public.profiles;
DROP POLICY IF EXISTS security_balance_insert ON public.balances;
DROP POLICY IF EXISTS security_orders_select ON public.orders;
DROP POLICY IF EXISTS security_orders_update ON public.orders;
DROP POLICY IF EXISTS security_org_chat_select ON public.driver_organization_messages;
DROP POLICY IF EXISTS security_org_chat_insert ON public.driver_organization_messages;
DROP POLICY IF EXISTS security_drivers_insert ON public.drivers;
DROP POLICY IF EXISTS security_avatar_insert ON storage.objects;
DROP POLICY IF EXISTS security_avatar_update ON storage.objects;
DROP POLICY IF EXISTS security_avatar_delete ON storage.objects;
DROP POLICY IF EXISTS security_location_insert ON public.driver_locations;
DROP POLICY IF EXISTS security_location_update ON public.driver_locations;
DROP TRIGGER IF EXISTS security_guard_profile ON public.profiles;
DROP TRIGGER IF EXISTS security_guard_order ON public.orders;

-- Restore normal Supabase email verification for future registrations.
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
 public.transactions, public.receivables, public.cash_deposit_requests,
 public.driver_organization_requests FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.balances FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles, public.orders FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

CREATE OR REPLACE FUNCTION public.security_guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF NEW.id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.role IS DISTINCT FROM 'client' OR NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'Privileged profile fields are server managed' USING ERRCODE='42501';
   END IF;
  ELSIF (to_jsonb(NEW) - ARRAY['full_name','phone','avatar_url','vehicle_type','vehicle_number','license_number','vehicle_brand','vehicle_model','organization_name','current_location','location_updated_at','updated_at'])
   IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['full_name','phone','avatar_url','vehicle_type','vehicle_number','license_number','vehicle_brand','vehicle_model','organization_name','current_location','location_updated_at','updated_at']) THEN
   RAISE EXCEPTION 'Privileged profile fields are server managed' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_guard_profile BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.security_guard_profile();

CREATE POLICY security_profiles_select ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
 USING (public.security_can_view_profile(id));
CREATE POLICY security_profiles_insert ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (id=auth.uid() AND role='client' AND organization_id IS NULL);
CREATE POLICY security_profiles_update ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE POLICY security_balance_insert ON public.balances AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (user_id=auth.uid() AND amount=0 AND currency='BYN');

CREATE OR REPLACE FUNCTION public.security_region_price(region_uuid uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT base_price FROM public.regions WHERE id=region_uuid AND is_active $$;
REVOKE ALL ON FUNCTION public.security_region_price(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.security_region_price(uuid) TO authenticated;

-- Only validated RPCs may set the executor, payment flags or delivery stages.
-- Customer edits/cancellation remain supported before a driver accepts.
CREATE OR REPLACE FUNCTION public.security_guard_order() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE price numeric;
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF NEW.customer_id IS DISTINCT FROM auth.uid() OR (NEW.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM auth.uid()) THEN
   RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
   IF NEW.status IS DISTINCT FROM 'searching_courier' OR NEW.executor_user_id IS NOT NULL
    OR NEW.driver_id IS NOT NULL OR coalesce(NEW.is_paid,false) OR NEW.visibility IS DISTINCT FROM 'public'
    OR NEW.accepted_at IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid initial order state' USING ERRCODE='42501'; END IF;
  ELSE
   IF OLD.status IS DISTINCT FROM 'searching_courier' OR OLD.executor_user_id IS NOT NULL
    OR NEW.status NOT IN ('searching_courier','cancelled') THEN
    RAISE EXCEPTION 'Order cannot be edited in this state' USING ERRCODE='42501'; END IF;
   IF (to_jsonb(NEW)-ARRAY['pickup_address','pickup_coordinates','pickup_entrance','pickup_floor','pickup_apartment','delivery_address','delivery_coordinates','delivery_entrance','delivery_floor','delivery_apartment','sender_phone','recipient_phone','description','ready_at','paid_by','region_id','base_price','final_price','item_type','weight','volume','courier_comment','status','cancelled_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['pickup_address','pickup_coordinates','pickup_entrance','pickup_floor','pickup_apartment','delivery_address','delivery_coordinates','delivery_entrance','delivery_floor','delivery_apartment','sender_phone','recipient_phone','description','ready_at','paid_by','region_id','base_price','final_price','item_type','weight','volume','courier_comment','status','cancelled_at']) THEN
    RAISE EXCEPTION 'Order execution and payment are server managed' USING ERRCODE='42501'; END IF;
  END IF;
  price := public.security_region_price(NEW.region_id);
  IF price IS NULL THEN RAISE EXCEPTION 'Inactive region'; END IF;
  NEW.base_price:=price; NEW.final_price:=price;
  IF NEW.status='cancelled' THEN NEW.cancelled_at:=now(); ELSE NEW.cancelled_at:=NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER security_guard_order BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.security_guard_order();
CREATE POLICY security_orders_select ON public.orders AS RESTRICTIVE FOR SELECT TO authenticated USING (
 auth.uid() IN(customer_id,client_id,executor_user_id)
 OR public.security_actor_role() IN ('admin','superadmin')
 OR public.security_owns_driver(executor_user_id)
 OR (status='searching_courier' AND visibility='public' AND public.security_actor_role() IN ('driver','customer')));
CREATE POLICY security_orders_update ON public.orders AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (customer_id=auth.uid() AND (client_id IS NULL OR client_id=auth.uid()) AND status='searching_courier' AND executor_user_id IS NULL)
 WITH CHECK (customer_id=auth.uid() AND (client_id IS NULL OR client_id=auth.uid()) AND executor_user_id IS NULL AND status IN ('searching_courier','cancelled'));

-- Read receipts do not grant the recipient permission to rewrite message content.
REVOKE UPDATE ON public.order_messages, public.driver_organization_messages FROM authenticated;
GRANT UPDATE(read_at) ON public.order_messages, public.driver_organization_messages TO authenticated;
CREATE POLICY security_org_chat_select ON public.driver_organization_messages AS RESTRICTIVE FOR SELECT TO authenticated USING (
 (organization_id=auth.uid() AND public.security_actor_role()='customer')
 OR (public.security_actor_role()='driver' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
 AND p.organization_id=driver_organization_messages.organization_id) AND (driver_id IS NULL OR driver_id=auth.uid())));
CREATE POLICY security_org_chat_insert ON public.driver_organization_messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 sender_id=auth.uid() AND ((organization_id=auth.uid() AND public.security_actor_role()='customer'
 AND (driver_id IS NULL OR public.security_owns_driver(driver_id)))
 OR (public.security_actor_role()='driver' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
 AND p.organization_id=driver_organization_messages.organization_id) AND (driver_id IS NULL OR driver_id=auth.uid()))));

-- A driver may not join an arbitrary fleet by inserting/updating the legacy row.
CREATE POLICY security_drivers_insert ON public.drivers AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (user_id=auth.uid() AND public.security_actor_role()='driver' AND fleet_id IS NULL);
REVOKE UPDATE ON public.drivers FROM authenticated;
GRANT UPDATE(vehicle_type,vehicle_number,license_number,is_available,current_location,shift_status,shift_started_at,shift_ended_at) ON public.drivers TO authenticated;

-- Restrict avatar writes to a UUID-prefixed filename owned by the authenticated user.
-- Public avatar reads are intentional; no new public photo bucket is created here.
CREATE POLICY security_avatar_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (bucket_id='avatars' AND (name LIKE auth.uid()::text || '/%' OR name LIKE auth.uid()::text || '-%'));
CREATE POLICY security_avatar_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (bucket_id='avatars' AND (name LIKE auth.uid()::text || '/%' OR name LIKE auth.uid()::text || '-%'))
 WITH CHECK (bucket_id='avatars' AND (name LIKE auth.uid()::text || '/%' OR name LIKE auth.uid()::text || '-%'));
CREATE POLICY security_avatar_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (bucket_id='avatars' AND (name LIKE auth.uid()::text || '/%' OR name LIKE auth.uid()::text || '-%'));
CREATE POLICY security_location_insert ON public.driver_locations AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (driver_id=auth.uid() AND public.security_actor_role()='driver' AND
 (order_id IS NULL OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.executor_user_id=auth.uid())));
CREATE POLICY security_location_update ON public.driver_locations AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (driver_id=auth.uid() AND public.security_actor_role()='driver')
 WITH CHECK (driver_id=auth.uid() AND (order_id IS NULL OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.executor_user_id=auth.uid())));

REVOKE ALL ON FUNCTION public.security_guard_profile(), public.security_guard_order() FROM PUBLIC,anon,authenticated;
UPDATE storage.buckets SET allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif'], file_size_limit=5242880 WHERE id='avatars';
COMMIT;
