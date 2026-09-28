-- Keep ordinary signup usable when email confirmation is required.
-- The role and balance never come from user-controlled signup metadata.
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 INSERT INTO public.profiles(id,email,role,full_name,phone)
 VALUES(NEW.id,NEW.email,'client',left(NEW.raw_user_meta_data->>'full_name',200),left(NEW.raw_user_meta_data->>'phone',40));
 INSERT INTO public.balances(user_id,amount,currency) VALUES(NEW.id,0,'BYN');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
COMMIT;
