const {test}=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./load-app.cjs')
const {loadCompanyOrderBoard,groupBoardOrders,BOARD_STATUSES}=load('lib/company-order-board.ts')
function db(rows,drivers=[],fail=false){
 const queries=[]
 return {queries,rpc:async()=>({data:drivers,error:null}),from(){
  const filters=[];return {select(){return this},eq(key,value){filters.push(row=>row[key]===value);return this},in(key,values){filters.push(row=>values.includes(row[key]));return this},order(){return this},async range(a,b){queries.push([a,b]);return {data:rows.filter(row=>filters.every(fn=>fn(row))).slice(a,b+1),error:fail?{code:'failed'}:null}}}
 }}
}
const order=(id,extra={})=>({id,status:'searching_courier',customer_id:'other',payment_organization_id:null,executor_user_id:null,visibility:'public',created_at:'2026-09-01T00:00:00Z',pickup_address:'Минск',delivery_address:'Витебск',...extra})
test('board combines owned, current drivers, historical company and public offers without duplicates',async()=>{
 const rows=[order('own',{customer_id:'org'}),order('own-driver',{customer_id:'org',executor_user_id:'driver',status:'courier_accepted'}),order('public'),order('history',{payment_organization_id:'org',status:'completed'}),order('private-foreign',{visibility:'assigned'}),order('foreign-active',{status:'courier_coming'})]
 const result=await loadCompanyOrderBoard(db(rows,[{id:'driver',full_name:'Driver'}]),'org',true)
 assert.deepEqual(Array.from(result.orders,o=>o.id).sort(),['history','own','own-driver','public']);assert.equal(result.drivers.length,1)
})
test('query paging retains orders beyond the database page size',async()=>{
 const rows=Array.from({length:205},(_,i)=>order(`order-${i}`,{customer_id:'org'}))
 const result=await loadCompanyOrderBoard(db(rows),'org',true);assert.equal(result.orders.length,205)
})
test('no drivers still shows company orders and public offers',async()=>{
 const result=await loadCompanyOrderBoard(db([order('public'),order('own',{customer_id:'org'})]),'org',true);assert.equal(result.orders.length,2)
})
test('database failure cannot be shown as an empty board',async()=>{
 await assert.rejects(loadCompanyOrderBoard(db([],[],true),'org',true))
})
test('all six statuses are separate columns and filters combine',()=>{
 const rows=BOARD_STATUSES.map((status,i)=>order(String(i),{status,completed_at:new Date().toISOString(),order_number:i+1,executor_user_id:'driver'}))
 const groups=groupBoardOrders(rows,'','');for(const status of BOARD_STATUSES)assert.equal(groups[status].length,1)
 assert.equal(groupBoardOrders(rows,'витебск','driver').completed.length,1)
 assert.equal(groupBoardOrders(rows,'6','driver').cancelled.length,1)
 assert.equal(groupBoardOrders(rows,'','someone-else').completed.length,0)
})
test('board endpoint rejects other roles before accessing orders',async()=>{
 let loaded=false
 const {GET}=load('app/api/customer/order-board/route.ts',{
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({})},
  '@/lib/api/auth':{requireRole:async()=>({ok:false,response:new Response(null,{status:403})})},
  '@/lib/company-order-board':{loadCompanyOrderBoard:async()=>{loaded=true}},
 })
 assert.equal((await GET()).status,403);assert.equal(loaded,false)
})
test('board endpoint uses authenticated company, never a supplied account identifier',async()=>{
 let company
 const {GET}=load('app/api/customer/order-board/route.ts',{
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({})},
  '@/lib/api/auth':{requireRole:async()=>({ok:true,user:{id:'own-company'}})},
  '@/lib/company-order-board':{loadCompanyOrderBoard:async(_,id)=>{company=id;return {orders:[],drivers:[]}}},
 })
 assert.equal((await GET()).status,200);assert.equal(company,'own-company')
})

test('completed column uses completion day in Minsk and newest completion first',()=>{
 const now=new Date('2026-09-28T22:00:00Z')
 const rows=[order('yesterday',{status:'completed',completed_at:'2026-09-28T20:59:59Z'}),order('older',{status:'completed',completed_at:'2026-09-28T21:00:00Z'}),order('newest',{status:'completed',completed_at:'2026-09-28T21:59:00Z'}),order('undated',{status:'completed',completed_at:null})]
 assert.deepEqual(Array.from(groupBoardOrders(rows,'','',now).completed,o=>o.id),['newest','older'])
})
