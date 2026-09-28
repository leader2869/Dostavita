const {test}=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./load-app.cjs')
const driverId='10000000-0000-4000-8000-000000000002'
function route({allowed=true,error=null}={}){
 const calls=[]
 const api=load('app/api/payroll/route.ts',{
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:'result',error}}})},
  '@/lib/api/auth':{requireRole:async()=>allowed?{ok:true,user:{id:'company'}}:{ok:false,response:new Response(null,{status:403})}},
 })
 return {...api,calls}
}
const request=body=>new Request('https://example.test/api/payroll',{method:'POST',body:JSON.stringify(body)})
test('terms delegate employer identity to guarded SQL rather than caller input',async()=>{
 const r=route();const response=await r.POST(request({action:'terms',driverId,monthlyAmount:1000,orderMode:'percent',orderValue:40,organizationId:'forged'}))
 assert.equal(response.status,200);assert.equal(r.calls[0].name,'set_driver_payroll_terms');assert.equal(r.calls[0].args.p_order_value,40);assert.equal(r.calls[0].args.organizationId,undefined)
})
test('unauthorized actors cannot write payroll',async()=>{
 const r=route({allowed:false});assert.equal((await r.POST(request({}))).status,403);assert.equal(r.calls.length,0)
})
test('negative payout cannot reach SQL',async()=>{
 const r=route();assert.equal((await r.POST(request({action:'payment',driverId,amount:-5,month:null,requestId:driverId}))).status,400);assert.equal(r.calls.length,0)
})
test('payment forwards stable retry key and no calendar month',async()=>{
 const r=route();assert.equal((await r.POST(request({action:'payment',driverId,amount:5,month:null,requestId:driverId}))).status,200)
 assert.equal(r.calls[0].args.p_request_id,driverId);assert.equal(r.calls[0].args.p_period_month,null)
})
test('SQL overpayment rejection is a visible validation error',async()=>{
 const r=route({error:{code:'22023',message:'Overpayment'}});assert.equal((await r.POST(request({action:'payment',driverId,amount:5,month:null,requestId:driverId}))).status,400)
})
test('payroll reads use actor-scoped aggregate RPC',async()=>{
 const r=route();assert.equal((await r.GET()).status,200);assert.equal(r.calls[0].name,'get_my_payroll')
})
