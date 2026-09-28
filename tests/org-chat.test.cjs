const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./load-app.cjs')
const { markOrgMessagesRead } = load('lib/org-chat.ts')
test('receipt helper returns only confirmed rows, including zero-row denial', async () => {
 const result = await markOrgMessagesRead({rpc:async()=>({data:[],error:null})},['foreign-id'])
 assert.equal(result.length,0)
})
test('receipt helper batches, deduplicates and retains server timestamps', async () => {
 let calls=0
 const ids=Array.from({length:501},(_,i)=>String(i))
 const result=await markOrgMessagesRead({rpc:async(name,{message_ids})=>{
  calls++;assert.equal(name,'mark_org_messages_read');assert.ok(message_ids.length<=500)
  return {data:message_ids.map(id=>({id,read_at:'server-time'})),error:null}
 }},[...ids,'0'])
 assert.equal(calls,2);assert.equal(result.length,501);assert.equal(result[0].read_at,'server-time')
})
test('receipt errors are not reported as successful reads',async()=>{
 await assert.rejects(()=>markOrgMessagesRead({rpc:async()=>({data:null,error:new Error('denied')})},['id']),/denied/)
})
