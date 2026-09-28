-- An account can use several devices; each browser endpoint remains unique.
BEGIN;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);
NOTIFY pgrst,'reload schema';
COMMIT;
