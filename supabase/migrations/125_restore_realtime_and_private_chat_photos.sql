-- Complete services excluded from a public-schema/data-only restore.
BEGIN;
DO $$ DECLARE t text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF;
 FOREACH t IN ARRAY ARRAY['orders','profiles','driver_locations','order_messages','driver_organization_messages','order_rejections','cash_deposit_requests'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END IF;
 END LOOP;
END $$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('chat-photos','chat-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

-- Path: driver-org-chat/<organization>/<driver or general>/<uploader>/<uuid>.<ext>
CREATE OR REPLACE FUNCTION public.security_chat_photo_access(object_name text,write_access boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org uuid; driver uuid; owner_id text; actor_role text;
BEGIN
 PERFORM public.security_assert(auth.uid() IS NOT NULL);
 IF object_name !~ '^driver-org-chat/[0-9a-f-]{36}/(general|[0-9a-f-]{36})/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$' THEN RETURN false; END IF;
 BEGIN
  org:=split_part(object_name,'/',2)::uuid;
  IF split_part(object_name,'/',3)<>'general' THEN driver:=split_part(object_name,'/',3)::uuid; END IF;
 EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 owner_id:=split_part(object_name,'/',4);
 IF write_access AND owner_id<>auth.uid()::text THEN RETURN false; END IF;
 actor_role:=public.security_actor_role();
 RETURN (actor_role='customer' AND org=auth.uid() AND (driver IS NULL OR public.security_owns_driver(driver)))
 OR (actor_role='driver' AND (driver IS NULL OR driver=auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND organization_id=org));
END $$;
REVOKE ALL ON FUNCTION public.security_chat_photo_access(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.security_chat_photo_access(text,boolean) TO authenticated;

-- Existing avatar restrictions applied to every bucket. Extend them explicitly;
-- never make chat photos public to bypass authorization.
DROP POLICY IF EXISTS security_avatar_insert ON storage.objects;
DROP POLICY IF EXISTS security_avatar_update ON storage.objects;
DROP POLICY IF EXISTS security_avatar_delete ON storage.objects;
DROP POLICY IF EXISTS security_storage_read ON storage.objects;
CREATE POLICY security_storage_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
 bucket_id='avatars' OR (bucket_id='chat-photos' AND public.security_chat_photo_access(name)));
CREATE POLICY security_avatar_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 (bucket_id='avatars' AND (name LIKE auth.uid()::text||'/%' OR name LIKE auth.uid()::text||'-%'))
 OR (bucket_id='chat-photos' AND public.security_chat_photo_access(name,true)));
CREATE POLICY security_avatar_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(
 bucket_id='avatars' AND (name LIKE auth.uid()::text||'/%' OR name LIKE auth.uid()::text||'-%')) WITH CHECK(
 bucket_id='avatars' AND (name LIKE auth.uid()::text||'/%' OR name LIKE auth.uid()::text||'-%'));
CREATE POLICY security_avatar_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(
 (bucket_id='avatars' AND (name LIKE auth.uid()::text||'/%' OR name LIKE auth.uid()::text||'-%'))
 OR (bucket_id='chat-photos' AND public.security_chat_photo_access(name,true)));
DROP POLICY IF EXISTS chat_photo_read ON storage.objects;
DROP POLICY IF EXISTS chat_photo_upload ON storage.objects;
DROP POLICY IF EXISTS chat_photo_delete ON storage.objects;
CREATE POLICY chat_photo_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='chat-photos' AND public.security_chat_photo_access(name));
CREATE POLICY chat_photo_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='chat-photos' AND public.security_chat_photo_access(name,true));
CREATE POLICY chat_photo_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='chat-photos' AND public.security_chat_photo_access(name,true));
NOTIFY pgrst,'reload schema';
COMMIT;
