const {test} = require('node:test')
const assert = require('node:assert/strict')
const {load} = require('./load-app.cjs')
const {isTrustedPushEndpoint} = load('lib/push-endpoint.ts')
for (const endpoint of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://localhost/a','https://web.push.apple.com.evil.test/a','https://evilpush.apple.com/a','https://fcm.googleapis.com.evil.test/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a']) {
 test('reject SSRF destination '+endpoint,()=>assert.equal(isTrustedPushEndpoint(endpoint),false))
}
test('allow real browser push endpoints',()=>{
 for (const endpoint of ['https://fcm.googleapis.com/fcm/send/test','https://updates.push.services.mozilla.com/wpush/v2/test','https://web.push.apple.com/test','https://region.web.push.apple.com/test']) assert.equal(isTrustedPushEndpoint(endpoint),true)
})
test('partial admin update preserves unspecified profile fields',async()=>{
 let patch
 const route=load('app/api/admin/update-user/route.ts',{
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({})},
  '@/lib/api/auth':{requireSuperadmin:async()=>({ok:true,user:{id:'admin'}})},
  '@/lib/supabase/admin':{createAdminSupabaseClient:()=>({from:()=>({update:(p)=>{patch=p;return {eq:async()=>({error:null})}}})})}
 })
 const response=await route.POST(new Request('https://example.test',{method:'POST',body:JSON.stringify({userId:'10000000-0000-4000-8000-000000000001',fullName:'Updated'})}))
 assert.equal(response.status,200);assert.equal(JSON.stringify(patch),JSON.stringify({full_name:'Updated'}))
})
