import json,re,sys
from pathlib import Path
s=json.loads((Path(__file__).parent/'fixtures/security-baseline.json').read_text())
parts=['''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SEQUENCE public.order_number_seq;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
CREATE DOMAIN public.geography AS text;
CREATE FUNCTION public.st_astext(public.geography) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT $1::text $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,allowed_mime_types text[],file_size_limit bigint);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
''']
types={'int4':'integer','int8':'bigint','bool':'boolean','geography':'public.geography','_text':'text[]'}
for t in sorted(set(c['table'] for c in s['columns'])):
 cs=[]
 for c in [c for c in s['columns'] if c['table']==t]:
  d=c['default']
  if d and 'nextval' in d:
   name=re.search("'([^']+)'",d)[1];parts.append(f'CREATE SEQUENCE IF NOT EXISTS {name};')
  if d:d=d.replace('uuid_generate_v4()','gen_random_uuid()')
  cs.append('"'+c['name']+'" '+types.get(c['type'],c['type'])+(' DEFAULT '+d if d else '')+(' NOT NULL' if c['nullable']=='NO' else ''))
 parts.append('CREATE TABLE public.'+t+'('+','.join(cs)+'); ALTER TABLE public.'+t+' ENABLE ROW LEVEL SECURITY;')
for c in sorted(s['constraints'],key=lambda c:c['definition'].startswith('FOREIGN')):
 parts.append('ALTER TABLE public.'+c['table']+' ADD CONSTRAINT "'+c['name']+'" '+c['definition']+';')
# PostGIS is outside these authorization tests; no spatial function is invoked.
for f in s['functions']:
 if f['name'] in ('rls_auto_enable','auto_confirm_user_email','create_chat_photos_storage_policies'):continue
 parts.append(f['definition'].rstrip()+';')
for p in s['policies']:
 roles=','.join(p['roles']);schema='storage' if p['table']=='objects' else 'public'
 parts.append('CREATE POLICY "'+p['name'].replace('"','""')+'" ON '+schema+'.'+p['table']+' FOR '+p['cmd']+' TO '+roles+(' USING ('+p['using']+')' if p['using'] else '')+(' WITH CHECK ('+p['check']+')' if p['check'] else '')+';')
parts.append('''GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON ALL TABLES IN SCHEMA public,storage TO anon,authenticated,service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_order_payment_processed AFTER UPDATE OF is_paid ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_order_payment();
CREATE TRIGGER prevent_paid_order_reset BEFORE UPDATE OF is_paid ON public.orders FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_order_reset();
CREATE TRIGGER trigger_assign_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();
''')
Path(sys.argv[1]).write_text('\n'.join(parts))
