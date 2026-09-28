const {test}=require('node:test')
const assert=require('node:assert/strict')
const {NextRequest}=require('next/server')
const {load}=require('./load-app.cjs')
const endpoint='https://fcm.googleapis.com/test-device'
function route(file) {
 const calls=[]
 const db={from:table=>({
  upsert:async(row,options)=>{calls.push({table,row,options});return {error:null}},
  delete(){calls.push({table,delete:true});return this},
  eq(key,value){calls.push({key,value});return this},then(resolve){return Promise.resolve({error:null}).then(resolve)},
 })}
 return {calls,...load(file,{'@/lib/supabase/server':{createServerSupabaseClient:()=>db},'@/lib/api/auth':{getAuthUser:async()=>({ok:true,user:{id:'current-user'}})}})}
}
test('register is an atomic per-endpoint upsert scoped to current user',async()=>{
 const r=route('app/api/push/register/route.ts')
 const res=await r.POST(new Request('https://example.test/api/push/register',{method:'POST',body:JSON.stringify({subscription:{endpoint,keys:{p256dh:'key',auth:'key'}}})}))
 assert.equal(res.status,200);assert.equal(r.calls[0].row.user_id,'current-user');assert.equal(r.calls[0].options.onConflict,'endpoint')
})
test('unsubscribe targets one endpoint and the current account',async()=>{
 const r=route('app/api/push/unregister/route.ts')
 const res=await r.POST(new Request('https://example.test/api/push/unregister',{method:'POST',body:JSON.stringify({endpoint})}))
 assert.equal(res.status,200);assert.ok(r.calls.some(c=>c.key==='endpoint'&&c.value===endpoint));assert.ok(r.calls.some(c=>c.key==='user_id'&&c.value==='current-user'))
})
test('empty unsubscribe cannot erase every device',async()=>{
 const r=route('app/api/push/unregister/route.ts')
 const res=await r.POST(new Request('https://example.test/api/push/unregister',{method:'POST',body:'{}'}))
 assert.equal(res.status,400);assert.equal(r.calls.length,0)
})
test('logout redirects with GET to own origin even if caller supplies another Origin',async()=>{
 const {POST}=load('app/auth/signout/route.ts',{'@/lib/supabase/server':{createServerSupabaseClient:()=>({auth:{signOut:async()=>({})}})}})
 const r=await POST(new NextRequest('https://example.test/auth/signout',{method:'POST',headers:{Origin:'https://untrusted.example'}}))
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),new URL('/login',process.env.NEXT_PUBLIC_APP_URL||'https://example.test').href)
})
test('server registration failure does not silently succeed',async()=>{
 const {saveDevicePushSubscription}=load('lib/browser-push.ts',{}, {setTimeout,clearTimeout,fetch:async()=>({ok:false,status:500})})
 await assert.rejects(saveDevicePushSubscription({endpoint,toJSON:()=>({keys:{auth:'test',p256dh:'test'}})}))
})
test('logout revokes this browser even when server cleanup fails',async()=>{
 let revoked=0,body
 const subscription={endpoint,unsubscribe:async()=>{revoked++}}
 const {removeDevicePushSubscription}=load('lib/browser-push.ts',{}, {setTimeout,clearTimeout,
  navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>subscription}})}},
  fetch:async(_,opts)=>{body=JSON.parse(opts.body);return {ok:false,status:500}},
 })
 await assert.rejects(removeDevicePushSubscription());assert.equal(revoked,1);assert.equal(body.endpoint,endpoint)
})
test('unsupported provider is distinguished from a network failure',async()=>{
 const {saveDevicePushSubscription}=load('lib/browser-push.ts',{}, {setTimeout,clearTimeout,fetch:async()=>({ok:false,status:400,json:async()=>({error:{code:'PUSH_UNSUPPORTED_PROVIDER',message:'Unsupported push service'}})})})
 await assert.rejects(saveDevicePushSubscription({endpoint,toJSON:()=>({keys:{auth:'test',p256dh:'test'}})}),/Unsupported push service/)
})
