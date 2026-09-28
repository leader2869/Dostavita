-- Restore deployment ACLs independently of schema exports (which can omit grants).
-- Safe to reapply. Financial mutations remain available only through guarded RPCs.
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
 public.transactions, public.receivables, public.cash_deposit_requests,
 public.driver_organization_requests, public.driver_org_message_reads FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.balances FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles, public.orders FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON public.driver_organization_messages_for_me FROM PUBLIC,anon;
REVOKE UPDATE ON public.order_messages, public.driver_organization_messages FROM authenticated;
REVOKE UPDATE(read_at) ON public.driver_organization_messages FROM authenticated;
GRANT UPDATE(read_at) ON public.order_messages TO authenticated;
REVOKE UPDATE ON public.drivers FROM authenticated;
GRANT UPDATE(vehicle_type,vehicle_number,license_number,is_available,current_location,shift_status,shift_started_at,shift_ended_at) ON public.drivers TO authenticated;

-- Payroll tables are added by migration 127; keep re-running this restore safe.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['driver_payroll_terms','driver_payroll_current','driver_payroll_orders','driver_payroll_ledger'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',t);
   EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  END IF;
 END LOOP;
END $$;

-- Restrictive policies also protect a restored database with overly broad grants.
DO $policies$
DECLARE t text; operation text;
BEGIN
 FOREACH t IN ARRAY ARRAY['transactions','receivables','cash_deposit_requests','driver_organization_requests','driver_org_message_reads','balances'] LOOP
  FOREACH operation IN ARRAY ARRAY['UPDATE','DELETE'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS security_rpc_only_%s ON public.%I',lower(operation),t);
   EXECUTE format('CREATE POLICY security_rpc_only_%s ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING(false)',lower(operation),t,operation);
  END LOOP;
  IF t <> 'balances' THEN
   EXECUTE format('DROP POLICY IF EXISTS security_rpc_only_insert ON public.%I',t);
   EXECUTE format('CREATE POLICY security_rpc_only_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false)',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['profiles','orders'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS security_no_direct_delete ON public.%I',t);
  EXECUTE format('CREATE POLICY security_no_direct_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING(false)',t);
 END LOOP;
END $policies$;

DO $acl$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature); END LOOP;
END $acl$;

DO $acl$ DECLARE f record; BEGIN FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('accept_order','approve_cash_deposit_request','cancel_cash_deposit_request','cancel_organization_request','check_driver_role','check_user_role','complete_order','create_driver_organization_request','deposit_cash_to_organization','get_admin_stats','get_all_drivers','get_all_orders_for_admin','get_all_regions','get_all_users','get_client_receivables','get_client_transactions','get_delivery_settings','get_driver_cancelled_orders','get_driver_last_location','get_driver_location_for_order','get_driver_organization_info','get_driver_profile_for_client','get_driver_profile_for_organization','get_driver_rejected_orders','get_driver_requests','get_driver_track','get_driver_track_period','get_driver_track_with_time','get_organization_balance','get_organization_drivers','get_organization_drivers_with_active_orders','get_organization_finances','get_organization_orders','get_organization_receivables','get_organization_requests','get_user_profile','get_user_saved_addresses','is_admin','is_driver_organization','pickup_order','process_order_payment','reject_cash_deposit_request','respond_to_organization_request','search_available_drivers','security_actor_role','security_assert','security_can_view_profile','security_owns_driver','start_coming_to_pickup','update_driver_location','update_driver_organization','withdraw_cash_from_driver','security_region_price','mark_org_messages_read','record_driver_location','security_chat_photo_access','set_driver_payroll_terms','record_driver_payroll','get_my_payroll') LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END LOOP; END $acl$;


NOTIFY pgrst, 'reload schema';
COMMIT;
