const {test}=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./load-app.cjs')
const {loadDriverDashboardOrders}=load('lib/driver-dashboard-orders.ts')
function database({available=[],hidden=[],active=[],failure}={}) {
 const calls=[]
 return {calls,from(table){
  const filters=[]
  return {
   select(){return this},eq(key,value){filters.push([key,value]);return this},in(key,value){filters.push([key,value]);return this},order(){return this},
   async range(from,to){
    const kind=table==='order_rejections'?'hidden':filters.some(([key])=>key==='executor_user_id')?'active':'available'
    calls.push({table,kind,filters,from,to})
    return {data:failure===kind?null:({available,hidden,active}[kind]).slice(from,to+1),error:failure===kind?{code:'database-unavailable'}:null}
   },
  }
 }}
}
test('hidden newest orders cannot hide older available orders across database pages',async()=>{
 const available=Array.from({length:151},(_,i)=>({id:`order-${i}`}))
 const hidden=available.slice(0,105).map(row=>({order_id:row.id}))
 const active=Array.from({length:12},(_,i)=>({id:`active-${i}`}))
 const db=database({available,hidden,active})
 const result=await loadDriverDashboardOrders(db,'driver-1')
 assert.equal(result.available.length,46);assert.equal(result.available[0].id,'order-105')
 assert.equal(result.hidden.length,105);assert.equal(result.active.length,12)
 for(const call of db.calls.filter(c=>c.kind!=='available')) assert.ok(call.filters.some(([key,value])=>['driver_user_id','executor_user_id'].includes(key)&&value==='driver-1'))
})
for (const failure of ['available','hidden','active']) {
 test(`failed ${failure} query cannot masquerade as an empty order list`,async()=>{
  await assert.rejects(loadDriverDashboardOrders(database({failure}),'driver-1'),/Failed to load driver orders/)
 })
}
test('a complete empty result remains a legitimate empty dashboard',async()=>{
 const result=await loadDriverDashboardOrders(database(),'driver-1')
 assert.equal(result.available.length,0);assert.equal(result.hidden.length,0);assert.equal(result.active.length,0)
})
