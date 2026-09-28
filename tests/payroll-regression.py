"""Real PostgreSQL authorization tests; no connection to an external database."""
from pathlib import Path
import tempfile,subprocess,os,shutil,concurrent.futures
root=Path(__file__).resolve().parents[1]
bin=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@15/bin'))
tmp=Path(tempfile.mkdtemp(prefix='dostavita-security-'));os.chmod(tmp,0o700)
def run(a,**kw):return subprocess.run([str(v) for v in a],check=True,capture_output=True,text=True,**kw)
def sql(s):return run([bin/'psql','-h',tmp,'-p','55443','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=s).stdout.strip()
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
import uuid,json
started=False
def rejected(n,fn):
 try:fn()
 except subprocess.CalledProcessError:check(n,True)
 else:raise AssertionError(n+' allowed')
def new_order():
 order=str(uuid.uuid4())
 act(c,f"INSERT INTO orders(id,customer_id,client_id,pickup_address,pickup_coordinates,delivery_address,delivery_coordinates,base_price,region_id,final_price) VALUES('{order}','{c}','{c}','QA','(0,0)','QA','(0,0)',10,'{reg}',10)")
 return order
def accept(order):act(d,f"SELECT accept_order('{order}','{d}')")
def complete(order,paid=False):act(d,f"SELECT start_coming_to_pickup('{order}');SELECT pickup_order('{order}');SELECT process_order_payment('{order}',{str(paid).lower()});SELECT complete_order('{order}')")
def record(kind,amount,month='NULL',request=None,user=None):
 return act(user or g,f"SELECT record_driver_payroll('{d}','{kind}',{amount},{month},'{request or uuid.uuid4()}','QA')").splitlines()[-1]
def terms(mode,rate,monthly=0,user=None):return act(user or g,f"SELECT set_driver_payroll_terms('{d}',{monthly},'{mode}',{rate})")
try:
 run([bin/'initdb','-D',tmp/'data','-A','trust','--no-locale','-E','UTF8']);run([bin/'pg_ctl','-D',tmp/'data','-l',tmp/'log','-o',f"-k {tmp} -h '' -p 55443",'start']);started=True
 run(['python3',root/'tests/build-security-fixture.py',tmp/'baseline.sql']);sql((tmp/'baseline.sql').read_text())
 sql('ALTER TABLE storage.buckets ADD COLUMN name text; ALTER TABLE storage.buckets ADD COLUMN public boolean DEFAULT false')
 for number in range(119,128):
  path=next((root/'supabase/migrations').glob(f'{number}_*.sql'));sql(path.read_text())
 sql(f"INSERT INTO auth.users(id,email) VALUES('{c}','client@qa.invalid'),('{d}','driver@qa.invalid'),('{g}','org@qa.invalid'),('{other}','outsider@qa.invalid'); UPDATE profiles SET role='customer' WHERE id IN ('{g}','{other}'); UPDATE profiles SET role='driver',organization_id='{g}',vehicle_type='car',license_number='QA' WHERE id='{d}'; INSERT INTO regions(id,name,base_price) VALUES('{reg}','QA',10)")
 for actor in [d,other,c]:rejected('non employer cannot set terms',lambda a=actor:terms('percent',40,user=a))
 for mode,value,monthly in [('percent',101,0),('fixed',-1,0),('none',1,0),('bad',0,0),('percent',40,-1),('percent',40.001,0),('fixed',"'NaN'",0)]:
  rejected('invalid terms rejected',lambda:terms(mode,value,monthly))
 legacy=new_order();accept(legacy)
 terms('percent',40,1000)
 complete(legacy)
 check('orders accepted before terms are not retroactively charged',sql('SELECT count(*) FROM driver_payroll_ledger'),'0')
 first=new_order();accept(first)
 terms('percent',75,1100)
 complete(first)
 check('completed unpaid order accrues original percent',sql(f"SELECT amount::text FROM driver_payroll_ledger WHERE order_id='{first}'"),'4.00')
 check('completion is not dependent on client payment',sql(f"SELECT is_paid FROM orders WHERE id='{first}'"),'f')
 act(d,f"SELECT complete_order('{first}')")
 check('repeat completion never duplicates salary',sql(f"SELECT count(*) FROM driver_payroll_ledger WHERE order_id='{first}'"),'1')
 terms('fixed',3.25)
 fixed=new_order();accept(fixed);complete(fixed,True)
 check('fixed per-order salary',sql(f"SELECT amount::text FROM driver_payroll_ledger WHERE order_id='{fixed}'"),'3.25')
 for t in ['driver_payroll_terms','driver_payroll_current','driver_payroll_orders','driver_payroll_ledger']:
  for op in ['INSERT','UPDATE','DELETE']:check('payroll has no direct '+op+' grant on '+t,sql(f"SELECT has_table_privilege('authenticated','{t}','{op}')"),'f')
 check('other company cannot read payroll',act(other,'SELECT count(*) FROM driver_payroll_ledger').splitlines()[-1],'0')
 check('driver can read own salary',act(d,'SELECT count(*) FROM driver_payroll_ledger').splitlines()[-1],'2')
 check('outsider RPC contains no private summaries',len(json.loads(act(other,'SELECT get_my_payroll()').splitlines()[-1])['summaries']),0)
 rejected('driver cannot self-pay',lambda:record('payment',1,user=d))
 rejected('other company cannot pay this driver',lambda:record('payment',1,user=other))
 rejected('cannot overpay',lambda:record('payment',8))
 request=str(uuid.uuid4());payment=record('payment',2,request=request)
 check('payment retry is idempotent',record('payment',2,request=request),payment)
 rejected('idempotency key cannot change amount',lambda:record('payment',3,request=request))
 check('payroll payment does not debit client cash',sql(f"SELECT amount::text FROM balances WHERE user_id='{d}'"),'10.00')
 record('monthly',500,"'2026-09-01'")
 rejected('one monthly accrual per employer driver month',lambda:record('monthly',100,"'2026-09-01'"))
 rejected('future month cannot be accrued',lambda:record('monthly',1,"'2099-01-01'"))
 rejected('monthly amount cannot be zero',lambda:record('monthly',0,"'2026-08-01'"))
 def payout(_):
  try:return record('payment',400)
  except subprocess.CalledProcessError:return 'rejected'
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(payout,range(2)))
 check('parallel payouts cannot overpay',results.count('rejected'),1)
 totals=json.loads(act(g,'SELECT get_my_payroll()').splitlines()[-1])['summaries'][0]
 check('summary accruals',float(totals['accrued']),507.25);check('summary payouts',float(totals['paid']),402);check('summary unpaid',float(totals['outstanding']),105.25)
 terms('fixed',2);changing=new_order();accept(changing)
 sql(f"UPDATE profiles SET organization_id='{other}' WHERE id='{d}'")
 complete(changing)
 check('employer snapshot survives affiliation change',sql(f"SELECT organization_id FROM driver_payroll_ledger WHERE order_id='{changing}'"),g)
 rejected('former employer cannot change current terms',lambda:terms('fixed',9))
 record('payment',1)
 check('former employer can settle earned salary',sql(f"SELECT sum(amount)::text FROM driver_payroll_ledger WHERE kind='payment'"),'403.00')
 check('new employer cannot see old salary',act(other,'SELECT count(*) FROM driver_payroll_ledger').splitlines()[-1],'0')
 terms('none',0,user=other);free=new_order();accept(free);complete(free)
 check('no per-order rate means no automatic accrual',sql(f"SELECT count(*) FROM driver_payroll_ledger WHERE order_id='{free}'"),'0')
 terms('none',0,1000,user=other)
 sql(f"UPDATE profiles SET organization_id=NULL WHERE id='{d}'")
 record('monthly',100,"'2026-09-01'",user=other)
 check('former employer can settle final monthly salary with terms but no prior earnings',act(other,"SELECT count(*) FROM driver_payroll_ledger").splitlines()[-1],'1')
 sql((root/'supabase/migrations/123_restore_deployment_privileges.sql').read_text())
 check('ACL restore preserves payroll RPC',act(d,"SELECT get_my_payroll()->>'role'").splitlines()[-1],'driver')
 check('anonymous payroll RPC unavailable',sql("SELECT count(*) FROM pg_proc WHERE proname IN ('get_my_payroll','record_driver_payroll','set_driver_payroll_terms','capture_driver_payroll') AND has_function_privilege('anon',oid,'EXECUTE')"),'0')
 print('All payroll checks passed; no external data used.')
except subprocess.CalledProcessError as e:
 print(e.stderr);raise
finally:
 if started:run([bin/'pg_ctl','-D',tmp/'data','stop','-m','fast'])
 shutil.rmtree(tmp)
