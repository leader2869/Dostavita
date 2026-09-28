-- Payroll is a separate immutable ledger, never mixed with client cash balances.
BEGIN;
CREATE TABLE public.driver_payroll_terms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.profiles(id),
 driver_id uuid NOT NULL REFERENCES public.profiles(id),
 monthly_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(monthly_amount>=0 AND monthly_amount<'Infinity'::numeric),
 order_mode text NOT NULL CHECK(order_mode IN ('none','percent','fixed')),
 order_value numeric(12,2) NOT NULL DEFAULT 0 CHECK(order_value>=0 AND order_value<'Infinity'::numeric),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((order_mode='none' AND order_value=0) OR (order_mode='percent' AND order_value<=100) OR order_mode='fixed')
);
CREATE INDEX driver_payroll_terms_owner ON public.driver_payroll_terms(organization_id,driver_id,created_at DESC);
CREATE TABLE public.driver_payroll_current (
 organization_id uuid NOT NULL REFERENCES public.profiles(id), driver_id uuid NOT NULL REFERENCES public.profiles(id),
 terms_id uuid NOT NULL REFERENCES public.driver_payroll_terms(id), PRIMARY KEY(organization_id,driver_id)
);
CREATE TABLE public.driver_payroll_orders (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id), organization_id uuid NOT NULL REFERENCES public.profiles(id),
 driver_id uuid NOT NULL REFERENCES public.profiles(id), terms_id uuid REFERENCES public.driver_payroll_terms(id),
 order_price numeric(12,2) NOT NULL, amount numeric(12,2) NOT NULL CHECK(amount>=0 AND amount<'Infinity'::numeric),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.driver_payroll_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.profiles(id),
 driver_id uuid NOT NULL REFERENCES public.profiles(id), kind text NOT NULL CHECK(kind IN ('order','monthly','payment')),
 amount numeric(12,2) NOT NULL CHECK(amount>0 AND amount<'Infinity'::numeric),
 order_id uuid REFERENCES public.orders(id), period_month date,
 request_id uuid NOT NULL DEFAULT gen_random_uuid(), note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 created_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='order' AND order_id IS NOT NULL AND period_month IS NULL) OR
       (kind='monthly' AND order_id IS NULL AND period_month IS NOT NULL AND extract(day FROM period_month)=1) OR
       (kind='payment' AND order_id IS NULL AND period_month IS NULL)),
 UNIQUE(organization_id,request_id)
);
CREATE UNIQUE INDEX driver_payroll_order_once ON public.driver_payroll_ledger(order_id) WHERE kind='order';
CREATE UNIQUE INDEX driver_payroll_month_once ON public.driver_payroll_ledger(organization_id,driver_id,period_month) WHERE kind='monthly';
CREATE INDEX driver_payroll_ledger_owner ON public.driver_payroll_ledger(organization_id,driver_id,created_at DESC);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['driver_payroll_terms','driver_payroll_current','driver_payroll_orders','driver_payroll_ledger'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY payroll_read ON public.%I FOR SELECT TO authenticated USING (auth.uid() IN (organization_id,driver_id) OR public.security_actor_role() IN (''admin'',''superadmin''))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.set_driver_payroll_terms(p_driver_id uuid,p_monthly_amount numeric,p_order_mode text,p_order_value numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 PERFORM public.security_assert(public.security_owns_driver(p_driver_id));
 PERFORM 1 FROM public.profiles WHERE id=p_driver_id FOR UPDATE;
 PERFORM public.security_assert(public.security_owns_driver(p_driver_id));
 IF p_monthly_amount IS NULL OR p_order_value IS NULL OR p_order_mode IS NULL
 OR NOT(p_monthly_amount BETWEEN 0 AND 9999999999.99 AND p_order_value BETWEEN 0 AND 9999999999.99)
 OR p_monthly_amount<>round(p_monthly_amount,2) OR p_order_value<>round(p_order_value,2)
 OR p_order_mode NOT IN ('none','percent','fixed') OR (p_order_mode='percent' AND p_order_value>100)
 OR (p_order_mode='none' AND p_order_value<>0) THEN RAISE EXCEPTION 'Некорректные условия зарплаты' USING ERRCODE='22023'; END IF;
 INSERT INTO public.driver_payroll_terms(organization_id,driver_id,monthly_amount,order_mode,order_value)
 VALUES(auth.uid(),p_driver_id,p_monthly_amount,p_order_mode,p_order_value) RETURNING id INTO result;
 INSERT INTO public.driver_payroll_current VALUES(auth.uid(),p_driver_id,result)
 ON CONFLICT(organization_id,driver_id) DO UPDATE SET terms_id=excluded.terms_id;
 RETURN result;
END $$;

-- Capture employer and rate when accepting, not when paying/completing later.
CREATE FUNCTION public.capture_driver_payroll() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE employer uuid; terms public.driver_payroll_terms; earned numeric;
BEGIN
 IF NEW.status='courier_accepted' AND OLD.status='searching_courier' THEN
  DELETE FROM public.driver_payroll_orders WHERE order_id=NEW.id
   AND NOT EXISTS(SELECT 1 FROM public.driver_payroll_ledger WHERE order_id=NEW.id AND kind='order');
  SELECT organization_id INTO employer FROM public.profiles WHERE id=NEW.executor_user_id;
  IF employer IS NOT NULL THEN
   SELECT t.* INTO terms FROM public.driver_payroll_current c JOIN public.driver_payroll_terms t ON t.id=c.terms_id
    WHERE c.organization_id=employer AND c.driver_id=NEW.executor_user_id;
   earned:=CASE terms.order_mode WHEN 'percent' THEN round(NEW.final_price*terms.order_value/100,2)
      WHEN 'fixed' THEN terms.order_value ELSE 0 END;
   INSERT INTO public.driver_payroll_orders(order_id,organization_id,driver_id,terms_id,order_price,amount)
    VALUES(NEW.id,employer,NEW.executor_user_id,terms.id,NEW.final_price,earned)
    ON CONFLICT(order_id) DO UPDATE SET organization_id=excluded.organization_id,driver_id=excluded.driver_id,terms_id=excluded.terms_id,order_price=excluded.order_price,amount=excluded.amount
    WHERE NOT EXISTS(SELECT 1 FROM public.driver_payroll_ledger WHERE order_id=NEW.id AND kind='order');
  END IF;
 END IF;
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
  INSERT INTO public.driver_payroll_ledger(organization_id,driver_id,kind,amount,order_id,created_by)
   SELECT organization_id,driver_id,'order',amount,order_id,auth.uid() FROM public.driver_payroll_orders
   WHERE order_id=NEW.id AND driver_id=NEW.executor_user_id AND amount>0 ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_driver_payroll AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.capture_driver_payroll();

CREATE FUNCTION public.record_driver_payroll(p_driver_id uuid,p_kind text,p_amount numeric,p_period_month date,p_request_id uuid,p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE existing public.driver_payroll_ledger; outstanding numeric; result uuid;
BEGIN
 PERFORM public.security_assert(public.security_actor_role()='customer');
 IF p_kind IS NULL OR p_kind NOT IN ('monthly','payment') OR p_amount IS NULL
 OR NOT(p_amount>0 AND p_amount<=9999999999.99) OR p_amount<>round(p_amount,2)
 OR p_request_id IS NULL OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Некорректные данные зарплаты' USING ERRCODE='22023'; END IF;
 IF (p_kind='monthly' AND (p_period_month IS NULL OR extract(day FROM p_period_month)<>1 OR p_period_month>date_trunc('month',timezone('Europe/Minsk',now()))::date))
 OR (p_kind='payment' AND p_period_month IS NOT NULL) THEN RAISE EXCEPTION 'Некорректный месяц начисления' USING ERRCODE='22023'; END IF;
 -- Serialize payouts and monthly confirmations per employer/driver.
 PERFORM pg_advisory_xact_lock(hashtextextended('payroll:'||auth.uid()::text||':'||p_driver_id::text,0));
 SELECT * INTO existing FROM public.driver_payroll_ledger WHERE organization_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
  IF existing.driver_id<>p_driver_id OR existing.kind<>p_kind OR existing.amount<>p_amount OR existing.period_month IS DISTINCT FROM p_period_month OR existing.note<>coalesce(p_note,'') THEN
   RAISE EXCEPTION 'Повторный запрос содержит другие данные' USING ERRCODE='22023'; END IF;
  RETURN existing.id;
 END IF;
 -- Historical employers retain the ability to settle an existing debt after detachment.
 PERFORM public.security_assert(public.security_owns_driver(p_driver_id) OR EXISTS(
  SELECT 1 FROM public.driver_payroll_ledger WHERE organization_id=auth.uid() AND driver_id=p_driver_id AND kind IN ('order','monthly')));
 IF p_kind='payment' THEN
  SELECT coalesce(sum(CASE WHEN kind='payment' THEN -amount ELSE amount END),0) INTO outstanding
  FROM public.driver_payroll_ledger WHERE organization_id=auth.uid() AND driver_id=p_driver_id;
  IF p_amount>outstanding THEN RAISE EXCEPTION 'Выплата превышает остаток зарплаты' USING ERRCODE='22023'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.driver_payroll_ledger WHERE organization_id=auth.uid() AND driver_id=p_driver_id AND kind='monthly' AND period_month=p_period_month) THEN
   RAISE EXCEPTION 'Оклад за этот месяц уже начислен' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.driver_payroll_ledger(organization_id,driver_id,kind,amount,period_month,request_id,note,created_by)
 VALUES(auth.uid(),p_driver_id,p_kind,p_amount,p_period_month,p_request_id,coalesce(p_note,''),auth.uid()) RETURNING id INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.get_my_payroll() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor uuid:=auth.uid(); actor_role text:=public.security_actor_role(); result jsonb;
BEGIN
 PERFORM public.security_assert(actor_role IN ('customer','driver'));
 WITH visible AS (
  SELECT l.* FROM public.driver_payroll_ledger l WHERE
   (actor_role='customer' AND l.organization_id=actor) OR (actor_role='driver' AND l.driver_id=actor)
 ), pairs AS (
  SELECT organization_id,driver_id FROM visible
  UNION SELECT organization_id,driver_id FROM public.driver_payroll_current WHERE
   (actor_role='customer' AND organization_id=actor) OR (actor_role='driver' AND driver_id=actor)
  UNION SELECT organization_id,id FROM public.profiles WHERE role='driver' AND organization_id IS NOT NULL
   AND ((actor_role='customer' AND organization_id=actor) OR (actor_role='driver' AND id=actor))
 ), summaries AS (
  SELECT p.organization_id,p.driver_id,d.full_name AS driver_name,coalesce(o.organization_name,o.full_name) AS organization_name,
   coalesce(sum(l.amount) FILTER(WHERE l.kind<>'payment'),0) AS accrued,
   coalesce(sum(l.amount) FILTER(WHERE l.kind='payment'),0) AS paid,
   coalesce(sum(CASE WHEN l.kind='payment' THEN -l.amount ELSE l.amount END),0) AS outstanding,
   (d.organization_id=p.organization_id AND d.role='driver') AS currently_employed,
   t.monthly_amount,t.order_mode,t.order_value,t.created_at AS terms_since
  FROM pairs p JOIN public.profiles d ON d.id=p.driver_id JOIN public.profiles o ON o.id=p.organization_id
  LEFT JOIN visible l ON l.organization_id=p.organization_id AND l.driver_id=p.driver_id
  LEFT JOIN public.driver_payroll_current c ON c.organization_id=p.organization_id AND c.driver_id=p.driver_id
  LEFT JOIN public.driver_payroll_terms t ON t.id=c.terms_id
  GROUP BY p.organization_id,p.driver_id,d.id,o.id,t.id
 ), history AS (
  SELECT v.*,o.order_number FROM visible v LEFT JOIN public.orders o ON o.id=v.order_id
  ORDER BY v.created_at DESC,v.id DESC LIMIT 100
 )
 SELECT jsonb_build_object('role',actor_role,'summaries',coalesce((SELECT jsonb_agg(s ORDER BY s.driver_name,s.organization_name) FROM summaries s),'[]'::jsonb),
  'history',coalesce((SELECT jsonb_agg(h ORDER BY h.created_at DESC,h.id DESC) FROM history h),'[]'::jsonb),
  'history_total',(SELECT count(*) FROM visible)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_my_payroll() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_payroll() TO authenticated;

REVOKE ALL ON FUNCTION public.capture_driver_payroll() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_driver_payroll_terms(uuid,numeric,text,numeric) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_driver_payroll(uuid,text,numeric,date,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_driver_payroll_terms(uuid,numeric,text,numeric),public.record_driver_payroll(uuid,text,numeric,date,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
