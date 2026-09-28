"""Real PostgreSQL authorization tests; no connection to an external database."""
from pathlib import Path
import tempfile,subprocess,os,shutil,concurrent.futures
root=Path(__file__).resolve().parents[1]
bin=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@15/bin'))
tmp=Path(tempfile.mkdtemp(prefix='dostavita-security-'));os.chmod(tmp,0o700)
def run(a,**kw):return subprocess.run([str(v) for v in a],check=True,capture_output=True,text=True,**kw)
def sql(s):return run([bin/'psql','-h',tmp,'-p','55441','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=s).stdout.strip()
def act(uid,s):return sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{uid}'; {s}")
def check(n,a,e=True):
 assert a==e,(n,a,e)
 print('PASS',n,flush=True)
def denied(n,fn):
 try:fn()
 except subprocess.CalledProcessError as e:
  check(n,any(x in e.stderr for x in ['Access denied','permission denied','row-level security','server managed','Invalid initial','cannot be edited','Privileged']))
 else:raise AssertionError(n+' allowed')
c='10000000-0000-4000-8000-000000000001';d='10000000-0000-4000-8000-000000000002';g='10000000-0000-4000-8000-000000000003';other='10000000-0000-4000-8000-000000000004';o='10000000-0000-4000-8000-000000000005';reg='10000000-0000-4000-8000-000000000006'
started=False
try:
 run([bin/'initdb','-D',tmp/'data','-A','trust','--no-locale','-E','UTF8']);run([bin/'pg_ctl','-D',tmp/'data','-l',tmp/'log','-o',f"-k {tmp} -h '' -p 55441",'start']);started=True
 run(['python3',root/'tests/build-security-fixture.py',tmp/'baseline.sql']);sql((tmp/'baseline.sql').read_text())
 for name in ['119_secure_application_functions.sql','120_secure_tables_and_storage.sql','121_safe_signup_profile.sql']:sql((root/'supabase/migrations'/name).read_text())
 for name in ['119_secure_application_functions.sql','120_secure_tables_and_storage.sql','121_safe_signup_profile.sql']:sql((root/'supabase/migrations'/name).read_text())
 sql(f"INSERT INTO auth.users(id,email) VALUES ('{c}','client@qa.invalid'),('{d}','driver@qa.invalid'),('{g}','org@qa.invalid'),('{other}','other@qa.invalid'); UPDATE profiles SET role='customer' WHERE id='{g}'; UPDATE profiles SET role='driver',organization_id='{g}',vehicle_type='car',license_number='QA' WHERE id='{d}'; INSERT INTO regions(id,name,base_price) VALUES('{reg}','QA',10);")
 denied('own role escalation',lambda:act(c,f"UPDATE profiles SET role='superadmin' WHERE id='{c}'"))
 denied('own organization reassignment',lambda:act(d,f"UPDATE profiles SET organization_id='{other}' WHERE id='{d}'"))
 denied('direct balance edit',lambda:act(d,f"UPDATE balances SET amount=100000 WHERE user_id='{d}'"))
 denied('anonymous directory',lambda:sql('SET ROLE anon; SELECT * FROM get_all_users()'))
 denied('client directory',lambda:act(c,'SELECT * FROM get_all_users()'))
 denied('foreign profile RPC',lambda:act(c,f"SELECT * FROM get_user_profile('{other}')"))
 check('foreign profile table hidden',act(c,f"SELECT count(*) FROM profiles WHERE id='{other}'").splitlines()[-1],'0')
 act(c,f"UPDATE profiles SET full_name='Updated' WHERE id='{c}'")
 check('own safe profile update',sql(f"SELECT full_name FROM profiles WHERE id='{c}'"),'Updated')
 act(c,f"INSERT INTO saved_addresses(user_id,address_type,label,address) VALUES('{c}','both','QA','QA')")
 denied('foreign address RPC',lambda:act(d,f"SELECT * FROM get_user_saved_addresses('{c}')"))
 check('own addresses visible',act(c,f"SELECT count(*) FROM get_user_saved_addresses('{c}')").splitlines()[-1],'1')
 act(c,f"INSERT INTO orders(id,customer_id,client_id,pickup_address,pickup_coordinates,delivery_address,delivery_coordinates,base_price,region_id,final_price) VALUES('{o}','{c}','{c}','QA','(0,0)','QA','(0,0)',0.01,'{reg}',0.01)")
 act(g,f"INSERT INTO orders(customer_id,pickup_address,pickup_coordinates,delivery_address,delivery_coordinates,base_price,region_id,final_price) VALUES('{g}','QA','(0,0)','QA','(0,0)',10,'{reg}',10)")
 check('organization creates order without client',sql(f"SELECT count(*) FROM orders WHERE customer_id='{g}'"),'1')
 check('server validates tariff',sql(f"SELECT final_price::numeric(10,2) FROM orders WHERE id='{o}'"),'10.00')
 denied('client marks paid',lambda:act(c,f"UPDATE orders SET is_paid=true WHERE id='{o}'"))
 denied('client sets executor',lambda:act(c,f"UPDATE orders SET executor_user_id='{d}' WHERE id='{o}'"))
 check('driver accepts',act(d,f"SELECT accept_order('{o}','{d}')").splitlines()[-1],'t')
 for name in ['start_coming_to_pickup','pickup_order','complete_order']:
  denied('anon '+name,lambda n=name:sql(f"SET ROLE anon; SELECT {n}('{o}')"))
  denied('foreign '+name,lambda n=name:act(other,f"SELECT {n}('{o}')"))
 act(d,f"SELECT start_coming_to_pickup('{o}'); SELECT pickup_order('{o}'); SELECT process_order_payment('{o}',true); SELECT complete_order('{o}');")
 check('paid completed once',sql(f"SELECT status||':'||(SELECT count(*) FROM transactions WHERE order_id='{o}') FROM orders WHERE id='{o}'"),'completed:1')
 denied('foreign deposit',lambda:act(other,f"SELECT deposit_cash_to_organization('{d}',5)"))
 for amount in ['-5','0',"'NaN'",'NULL']:
  denied('invalid withdrawal '+amount,lambda a=amount:act(g,f"SELECT withdraw_cash_from_driver('{d}',{a})"))
 req=act(d,f"SELECT deposit_cash_to_organization('{d}',5)").splitlines()[-1]
 denied('foreign cash approval',lambda:act(other,f"SELECT approve_cash_deposit_request('{req}')"))
 def approve(_):
  try:return act(g,f"SELECT approve_cash_deposit_request('{req}')").splitlines()[-1]
  except subprocess.CalledProcessError:return 'rejected'
 with concurrent.futures.ThreadPoolExecutor(2) as p:res=list(p.map(approve,range(2)))
 check('parallel cash approval only once',sorted(res),['rejected','t'])
 check('driver cash balance',sql(f"SELECT amount::numeric(10,2) FROM balances WHERE user_id='{d}'"),'5.00')
 check('organization cash balance',sql(f"SELECT amount::numeric(10,2) FROM balances WHERE user_id='{g}'"),'5.00')
 # RPC guards and grants must cover the entire exposed application surface.
 check('all exposed business RPCs have an explicit guard',sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND has_function_privilege('authenticated',oid,'EXECUTE') AND proname NOT IN ('security_actor_role','security_assert','security_owns_driver','security_can_view_profile','security_region_price','check_user_role','check_driver_role','is_driver_organization','is_admin') AND prosrc NOT LIKE '%security_assert%'"),'0')
 denied('internal financial helper hidden',lambda:act(d,f"SELECT security_lock_cash('{d}')"))
 denied('completed delivery no longer exposes driver location',lambda:act(c,f"SELECT * FROM get_driver_location_for_order('{d}','{o}')"))
 sql(f"INSERT INTO order_messages(order_id,sender_id,message) VALUES('{o}','{c}','Original')")
 denied('recipient cannot rewrite a message',lambda:act(d,"UPDATE order_messages SET message='Forged'"))
 for role in ['client','customer','driver','fleet','admin','superadmin']:
  sql(f"UPDATE profiles SET role='{role}' WHERE id='{other}'")
  check(role+' can read own profile',act(other,f"SELECT count(*) FROM get_user_profile('{other}')").splitlines()[-1],'1')
  if role not in ['admin','superadmin']:
   denied(role+' cannot read user directory',lambda:act(other,'SELECT * FROM get_all_users()'))
  else:check(role+' can read authorized directory',act(other,'SELECT count(*)>0 FROM get_all_users()').splitlines()[-1],'t')
 sql(f"UPDATE profiles SET role='client' WHERE id='{other}'")
 denied('driver cannot inject into foreign organization chat',lambda:act(d,f"INSERT INTO driver_organization_messages(organization_id,driver_id,sender_id,message) VALUES('{other}','{d}','{d}','Forbidden')"))
 check('anonymous app functions revoked',sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND has_function_privilege('anon',oid,'EXECUTE')"),'0')
 print('All security checks passed; no external data used.')
except subprocess.CalledProcessError as e:
 print(e.stderr);raise
finally:
 if started:run([bin/'pg_ctl','-D',tmp/'data','stop','-m','fast'])
 shutil.rmtree(tmp)
