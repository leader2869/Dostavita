-- Preserve payment ownership and align table access with RPC authorization.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_organization_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_organization_resolved boolean NOT NULL DEFAULT false;
-- Only existing receivables are reliable historical evidence. Never infer a past
-- employer from the driver's current affiliation. Unknown old orders fail closed
-- for organization payment; the assigned driver can still record payment.
UPDATE public.orders o SET payment_organization_id=r.organization_id, payment_organization_resolved=true
FROM public.receivables r WHERE r.order_id=o.id AND NOT o.payment_organization_resolved;

CREATE OR REPLACE FUNCTION public.security_capture_order_organization() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.payment_organization_id:=NULL; NEW.payment_organization_resolved:=false;
  IF NEW.executor_user_id IS NOT NULL THEN
   SELECT organization_id INTO NEW.payment_organization_id FROM public.profiles WHERE id=NEW.executor_user_id FOR SHARE;
   NEW.payment_organization_resolved:=true;
  END IF;
 ELSIF OLD.executor_user_id IS NULL AND NEW.executor_user_id IS NOT NULL THEN
  SELECT organization_id INTO NEW.payment_organization_id FROM public.profiles WHERE id=NEW.executor_user_id FOR SHARE;
  NEW.payment_organization_resolved:=true;
 ELSE
  NEW.payment_organization_id:=OLD.payment_organization_id;
  NEW.payment_organization_resolved:=OLD.payment_organization_resolved;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS security_capture_order_organization ON public.orders;
CREATE TRIGGER security_capture_order_organization BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.security_capture_order_organization();
REVOKE ALL ON FUNCTION public.security_capture_order_organization() FROM PUBLIC,anon,authenticated;
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
  WHERE id = order_uuid AND status = 'searching_courier' AND executor_user_id IS NULL AND visibility='public';
  RETURN FOUND;
END;
$function$;

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
  PERFORM pg_advisory_xact_lock(hashtextextended('dostavita:cash:'||executor_user_id::text,0)) FROM public.orders WHERE id=order_uuid;

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
    driver_org_id := order_record.payment_organization_id;
    IF NOT order_record.payment_organization_resolved OR driver_org_id IS NULL OR driver_org_id != auth.uid() THEN
      RAISE EXCEPTION 'Access denied: организация не является владельцем оплаты этого заказа';
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
    driver_org_id := order_record.payment_organization_id;
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


-- Restrictive SELECT also constrains every legacy permissive policy.
DROP POLICY IF EXISTS security_location_select ON public.driver_locations;
CREATE POLICY security_location_select ON public.driver_locations AS RESTRICTIVE FOR SELECT TO authenticated USING (
 driver_id=auth.uid() OR public.security_actor_role() IN ('admin','superadmin') OR public.security_owns_driver(driver_id)
 OR EXISTS(SELECT 1 FROM public.orders o WHERE o.executor_user_id=driver_locations.driver_id
 AND auth.uid() IN(o.customer_id,o.client_id) AND o.status IN ('courier_coming','courier_delivering')
 AND (driver_locations.order_id=o.id OR driver_locations.order_id IS NULL)
 AND driver_locations.created_at >= o.accepted_at));
DROP POLICY IF EXISTS security_location_insert ON public.driver_locations;
CREATE POLICY security_location_insert ON public.driver_locations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
 driver_id=auth.uid() AND public.security_actor_role()='driver' AND
 (order_id IS NULL OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.executor_user_id=auth.uid()
 AND o.status IN ('courier_coming','courier_delivering'))));
DROP POLICY IF EXISTS security_location_update ON public.driver_locations;
CREATE POLICY security_location_update ON public.driver_locations AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(driver_id=auth.uid() AND public.security_actor_role()='driver') WITH CHECK (
 driver_id=auth.uid() AND public.security_actor_role()='driver' AND
 (order_id IS NULL OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.executor_user_id=auth.uid()
 AND o.status IN ('courier_coming','courier_delivering'))));

-- Per-user receipts: one driver reading a general message does not mark it read
-- for every driver. Keep legacy read_at untouched; it has no per-reader meaning.
CREATE TABLE IF NOT EXISTS public.driver_org_message_reads (
 message_id uuid NOT NULL REFERENCES public.driver_organization_messages(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(message_id,user_id));
ALTER TABLE public.driver_org_message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_org_message_reads FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.driver_org_message_reads TO authenticated;
DROP POLICY IF EXISTS own_message_reads ON public.driver_org_message_reads;
CREATE POLICY own_message_reads ON public.driver_org_message_reads FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE VIEW public.driver_organization_messages_for_me WITH (security_invoker=true) AS
 SELECT m.id,m.organization_id,m.driver_id,m.sender_id,m.message,m.photo_url,m.created_at,r.read_at
 FROM public.driver_organization_messages m LEFT JOIN public.driver_org_message_reads r
 ON r.message_id=m.id AND r.user_id=auth.uid();
REVOKE ALL ON public.driver_organization_messages_for_me FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.driver_organization_messages_for_me TO authenticated;
REVOKE UPDATE(read_at) ON public.driver_organization_messages FROM authenticated;

CREATE OR REPLACE FUNCTION public.mark_org_messages_read(message_ids uuid[])
RETURNS TABLE(id uuid,read_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM public.security_assert(public.security_actor_role() IN ('driver','customer') AND cardinality(message_ids) BETWEEN 1 AND 500);
 RETURN QUERY
 INSERT INTO public.driver_org_message_reads AS receipts(message_id,user_id)
 SELECT m.id,auth.uid() FROM public.driver_organization_messages m
 WHERE m.id=ANY(message_ids) AND m.sender_id<>auth.uid() AND (
 (m.organization_id=auth.uid() AND public.security_actor_role()='customer' AND (m.driver_id IS NULL OR public.security_owns_driver(m.driver_id)))
 OR (public.security_actor_role()='driver' AND (m.driver_id IS NULL OR m.driver_id=auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.organization_id=m.organization_id)))
 ON CONFLICT(message_id,user_id) DO UPDATE SET read_at=receipts.read_at
 RETURNING receipts.message_id,receipts.read_at;
END $$;
REVOKE ALL ON FUNCTION public.mark_org_messages_read(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_org_messages_read(uuid[]) TO authenticated;
COMMIT;
