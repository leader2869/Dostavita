from pathlib import Path
import tempfile,subprocess,re,concurrent.futures,json,os
root=Path(__file__).resolve().parents[1]
tmp=Path(tempfile.mkdtemp(prefix='dostavita-sql-test-'))
os.chmod(tmp,0o700)
import shutil
bin=Path(os.environ.get('PG_BIN') or subprocess.check_output(['pg_config','--bindir'],text=True).strip())
def run(args,**kw):return subprocess.run([str(x) for x in args],check=True,capture_output=True,text=True,**kw)
run([bin/'initdb','-D',tmp/'data','-A','trust','--no-locale'])
run([bin/'pg_ctl','-D',tmp/'data','-l',tmp/'postgres.log','-o',f"-k {tmp} -h '' -p 55439",'start'])
def sql(s):return run([bin/'psql','-h',tmp,'-p','55439','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=s).stdout.strip()
c='00000000-0000-4000-8000-000000000001';d='00000000-0000-4000-8000-000000000002';d2='00000000-0000-4000-8000-000000000003';o='00000000-0000-4000-8000-000000000010'
def as_user(uid,body):return sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{uid}'; {body}")
results={}
try:
 sql('''CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated;
 CREATE TABLE profiles(id uuid PRIMARY KEY, role text, vehicle_type text, license_number text, organization_id uuid);
 CREATE TABLE orders(id uuid PRIMARY KEY,status text, executor_user_id uuid, accepted_at timestamptz,started_coming_at timestamptz, completed_at timestamptz,is_paid boolean,final_price numeric,order_number integer,paid_by text,client_id uuid);
 CREATE TABLE receivables(id uuid DEFAULT gen_random_uuid(),order_id uuid UNIQUE,driver_user_id uuid,organization_id uuid,debtor_type text,debtor_user_id uuid,amount numeric,currency text,status text,created_at timestamptz,updated_at timestamptz);
 CREATE TABLE transactions(id uuid DEFAULT gen_random_uuid(),user_id uuid,order_id uuid,amount numeric,type text,description text,created_at timestamptz,related_user_id uuid);
 CREATE TABLE balances(user_id uuid UNIQUE,amount numeric,currency text,updated_at timestamptz);
 GRANT SELECT,INSERT,UPDATE ON profiles TO authenticated;
 ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
 ''')
 calc = (root/'supabase/migrations/101_fix_balance_calculation_logic.sql').read_text()
 sql(re.search(r'CREATE OR REPLACE FUNCTION public.calculate_driver_balance[\s\S]*?\$\$[\s\S]*?\$\$[^;]*;', calc).group(0))
 # Actual policy file and actual function bodies, with no edits to their logic.
 sql((root/'supabase/migrations/016_fix_profiles_rls_policies.sql').read_text())
 for file in ['073_add_courier_accepted_status.sql','105_check_payment_before_complete_order.sql','106_fix_process_order_payment_for_completed_orders.sql']:
  text=(root/'supabase/migrations'/file).read_text()
  functions=re.findall(r'CREATE OR REPLACE FUNCTION[\s\S]*?\$\$[\s\S]*?\$\$[^;]*;',text)
  assert functions,file
  for f in functions:sql(f)
 sql(f"INSERT INTO profiles VALUES ('{c}','client',null,null,null),('{d}','driver','car','test',null),('{d2}','driver','car','test',null); INSERT INTO orders(id,status,is_paid,final_price,order_number,paid_by,client_id) VALUES ('{o}','searching_courier',false,10,1,'sender','{c}');")

 sql((root/'supabase/migrations/118_atomic_order_acceptance_and_payment.sql').read_text())
 # Reapplying the migration must also be safe.
 sql((root/'supabase/migrations/118_atomic_order_acceptance_and_payment.sql').read_text())
 def check(name,actual,expected):
  assert actual==expected,(name,actual,expected)
  print('PASS',name)
 def pay(uid=d,value='true',order=o):
  return as_user(uid,f"SELECT process_order_payment('{order}',{value});")
 def fails(fn):
  try:fn()
  except subprocess.CalledProcessError:return True
  return False
 check('cannot accept on behalf of another driver',as_user(c,f"SELECT accept_order('{o}','{d}');").splitlines()[-1],'f')
 # A delay makes overlapping UPDATEs deterministic, without changing their predicates.
 sql("CREATE FUNCTION delay_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$; CREATE TRIGGER audit_delay BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION delay_update();")
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  responses=list(pool.map(lambda uid:as_user(uid,f"SELECT accept_order('{o}','{uid}');").splitlines()[-1],[d,d2]))
 check('only one of two drivers accepts',sorted(responses),['f','t'])
 check('repeated acceptance fails',as_user(d,f"SELECT accept_order('{o}','{d}');").splitlines()[-1],'f')
 sql(f"UPDATE orders SET status='courier_delivering',executor_user_id='{d}',is_paid=false WHERE id='{o}';")
 check('foreign user cannot pay',fails(lambda:pay(c)),True)
 check('null payment rejected',fails(lambda:pay(value='null')),True)
 with concurrent.futures.ThreadPoolExecutor(4) as pool:list(pool.map(lambda _:pay(),range(4)))
 check('four parallel payments plus trigger create one credit',sql('SELECT count(*) FROM transactions;'),'1')
 check('balance equals one payment',sql(f"SELECT amount FROM balances WHERE user_id='{d}';"),'10.00')
 pay()
 check('retry after success creates no credit',sql('SELECT count(*) FROM transactions;'),'1')
 check('cannot reset paid through RPC',fails(lambda:pay(value='false')),True)
 check('cannot reset paid directly',fails(lambda:sql(f"UPDATE orders SET is_paid=false WHERE id='{o}';")),True)
 check('failed reset preserves paid flag',sql(f"SELECT is_paid FROM orders WHERE id='{o}';"),'t')
 # Two distinct orders paid to one driver must not overwrite each other's balance.
 o2='00000000-0000-4000-8000-000000000011';o3='00000000-0000-4000-8000-000000000012'
 for oid in [o2,o3]:
  sql(f"INSERT INTO orders(id,status,executor_user_id,is_paid,final_price,order_number,paid_by,client_id) VALUES ('{oid}','courier_delivering','{d}',false,10,2,'sender','{c}');")
 with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(lambda oid:pay(order=oid),[o2,o3]))
 check('different parallel orders preserve balance',sql(f"SELECT amount FROM balances WHERE user_id='{d}';"),'30.00')
 # Driver and organization competing for the same payment must not both receive credit.
 sql(f"UPDATE profiles SET role='customer' WHERE id='{c}'; UPDATE profiles SET organization_id='{c}' WHERE id='{d}';")
 o4='00000000-0000-4000-8000-000000000013'
 sql(f"INSERT INTO orders(id,status,executor_user_id,is_paid,final_price,order_number,paid_by,client_id) VALUES ('{o4}','completed','{d}',false,10,3,'sender','{c}');")
 with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(lambda uid:pay(uid=uid,order=o4),[c,d]))
 check('organization versus driver creates one credit',sql(f"SELECT count(*) FROM transactions WHERE order_id='{o4}';"),'1')
 # Explicit organization payment must not also credit the driver via the trigger.
 o5='00000000-0000-4000-8000-000000000014'
 sql(f"INSERT INTO orders(id,status,executor_user_id,is_paid,final_price,order_number,paid_by,client_id) VALUES ('{o5}','completed','{d}',false,10,4,'sender','{c}');")
 pay(uid=c,order=o5)
 check('organization is sole recipient',sql(f"SELECT user_id FROM transactions WHERE order_id='{o5}';"),c)
 o6='00000000-0000-4000-8000-000000000015'
 sql(f"INSERT INTO orders(id,status,executor_user_id,is_paid,final_price,order_number,paid_by,client_id) VALUES ('{o6}','courier_delivering','{d}',false,10,5,'sender','{c}');")
 with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(lambda _:pay(order=o6,value='false'),range(2)))
 check('repeated unpaid creates one debt',sql(f"SELECT count(*) FROM receivables WHERE order_id='{o6}';"),'1')
 pay(order=o6)
 check('payment clears debt',sql(f"SELECT count(*) FROM receivables WHERE order_id='{o6}';"),'0')
 # Failure to credit must roll back the whole operation, not leave an order marked paid.
 o7='00000000-0000-4000-8000-000000000016'
 sql(f"INSERT INTO orders(id,status,executor_user_id,is_paid,final_price,order_number,paid_by,client_id) VALUES ('{o7}','courier_delivering','{d}',false,10,6,'sender','{c}');")
 sql("CREATE FUNCTION reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_credit BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION reject_credit();")
 check('credit error returned',fails(lambda:pay(order=o7)),True)
 check('credit error leaves order unpaid',sql(f"SELECT is_paid FROM orders WHERE id='{o7}';"),'f')
 check('credit error creates no credit',sql(f"SELECT count(*) FROM transactions WHERE order_id='{o7}';"),'0')
 print('All SQL concurrency checks passed. No external database was used.')
finally:
 run([bin/'pg_ctl','-D',tmp/'data','stop','-m','fast'])
 shutil.rmtree(tmp)
