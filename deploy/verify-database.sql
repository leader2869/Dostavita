-- Run after every restore/migration. Fail deployment on unsafe effective grants.
\set ON_ERROR_STOP on
DO $$ DECLARE t text; op text; f record;
BEGIN
 FOREACH t IN ARRAY ARRAY['transactions','receivables','cash_deposit_requests','driver_organization_requests','driver_org_message_reads','driver_payroll_terms','driver_payroll_current','driver_payroll_orders','driver_payroll_ledger'] LOOP
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
   IF has_table_privilege('authenticated','public.'||t,op) THEN RAISE EXCEPTION 'Unsafe % grant on %',op,t; END IF;
  END LOOP;
  IF has_any_column_privilege('authenticated','public.'||t,'INSERT,UPDATE') THEN RAISE EXCEPTION 'Unsafe column grant on %',t; END IF;
 END LOOP;
 IF has_any_column_privilege('authenticated','public.balances','UPDATE') OR has_table_privilege('authenticated','public.balances','DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Balance can be modified directly'; END IF;
 FOR f IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e') LOOP
  IF has_function_privilege('anon',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Anonymous business RPC access: %',f.oid::regprocedure; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created' AND tgenabled='O') THEN RAISE EXCEPTION 'Signup profile trigger missing'; END IF;
 FOREACH t IN ARRAY ARRAY['orders','profiles','driver_locations','order_messages','driver_organization_messages','order_rejections','cash_deposit_requests'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN RAISE EXCEPTION 'Realtime table missing: %',t; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='chat-photos' AND public=false AND file_size_limit=5242880) THEN RAISE EXCEPTION 'Private chat photo bucket missing/misconfigured'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.push_subscriptions'::regclass AND conname='push_subscriptions_user_id_key') THEN RAISE EXCEPTION 'Push still limited to one device'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indrelid='public.push_subscriptions'::regclass AND indexrelid=to_regclass('public.idx_push_subscriptions_endpoint') AND indisunique AND indisvalid) THEN RAISE EXCEPTION 'Unique push endpoint index missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='capture_driver_payroll' AND tgenabled='O') THEN RAISE EXCEPTION 'Payroll accrual trigger missing'; END IF;
 IF NOT has_function_privilege('authenticated','public.get_my_payroll()','EXECUTE') THEN RAISE EXCEPTION 'Payroll read RPC missing'; END IF;
 RAISE NOTICE 'Deployment database invariants passed';
END $$;
