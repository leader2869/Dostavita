const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const { load } = require('./load-app.cjs')

function worker({ clients = [], data = {} } = {}) {
  const listeners = {}, shown = [], opened = []
  const self = { location: { origin: 'https://www.dostavita.by' },
    addEventListener: (name, cb) => { listeners[name] = cb },
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    clients: { matchAll: async () => clients, openWindow: async url => opened.push(url) },
  }
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/sw.js'), 'utf8'), { self, URL })
  return { listeners, shown, opened }
}
test('malformed push payload still shows a fallback notification', async () => {
  const x = worker(); let work
  x.listeners.push({ data: { json() { throw new Error('invalid JSON') } }, waitUntil(p) { work = p } })
  await work; assert.equal(x.shown.length, 1)
})
test('notification reuses an existing absolute URL instead of opening another tab', async () => {
  let focused = 0
  const x = worker({ clients: [{ url: 'https://www.dostavita.by/dashboard/driver', focus: async () => { focused++ } }] }); let work
  x.listeners.notificationclick({ notification: { data: {}, close() {} }, waitUntil(p) { work = p } })
  await work; assert.equal(focused, 1); assert.equal(x.opened.length, 0)
})
test('notification navigates an open same-site tab to its permitted destination', async () => {
  let navigated, focused = 0
  const client = { url: 'https://www.dostavita.by/dashboard', navigate: async url => { navigated=url; return client }, focus: async () => { focused++ } }
  const x=worker({ clients:[client] }); let work
  x.listeners.notificationclick({ notification:{ data:{url:'/dashboard/driver/orders/123'},close(){} },waitUntil(p){work=p} })
  await work; assert.equal(navigated,'https://www.dostavita.by/dashboard/driver/orders/123'); assert.equal(focused,1)
})
test('push cannot navigate outside the application origin', async () => {
  const x=worker();let work
  x.listeners.notificationclick({ notification:{ data:{url:'https://untrusted.example'},close(){} },waitUntil(p){work=p} })
  await work;assert.equal(x.opened[0],'https://www.dostavita.by/dashboard/driver')
})
test('close action does not open the app', () => {
  const x=worker();x.listeners.notificationclick({ action:'close',notification:{close(){}},waitUntil(){throw Error('unexpected navigation')} })
})

function tracker() {
  const callbacks=[], intervals=new Map(), events={}, state={online:true,visible:true,tracking:false,error:null}, sent=[]
  let sequence=0
  const target = prefix => ({ addEventListener:(n,fn)=>{events[prefix+n]=fn},removeEventListener:n=>{delete events[prefix+n]} })
  const {startLocationTracker}=load('lib/location-tracker.ts', {}, {AbortController})
  const stop=startLocationTracker({orderId:'test-order',interval:60000,onTracking:v=>{state.tracking=v},onError:v=>{state.error=v}}, {
    geolocation:{getCurrentPosition:(ok,bad,options)=>callbacks.push({ok,bad,options})},
    network:target('network:'),visibility:target('document:'),isOnline:()=>state.online,isVisible:()=>state.visible,
    fetch:async (url,options)=>{sent.push(JSON.parse(options.body));return {ok:true}},
    every:fn=>{const id=++sequence;intervals.set(id,fn);return id},cancelEvery:id=>intervals.delete(id),later:()=>++sequence,cancelLater() {},
  })
  return {callbacks,intervals,events,state,sent,stop}
}
test('initial GPS timeout keeps retrying and preserves zero heading/speed', async () => {
  const x=tracker();x.callbacks[0].bad({code:3});assert.equal(x.intervals.size,1)
  x.intervals.values().next().value();await x.callbacks[1].ok({coords:{latitude:53,longitude:27,accuracy:5,heading:0,speed:0}})
  assert.equal(x.sent[0].heading,0);assert.equal(x.sent[0].speed,0);assert.equal(x.state.tracking,true);x.stop()
})
test('returning online acquires a fresh GPS point', () => {
  const x=tracker();x.callbacks[0].bad({code:3});x.state.online=false
  x.intervals.values().next().value();assert.equal(x.callbacks.length,1)
  x.state.online=true;x.events['network:online']();assert.equal(x.callbacks.length,2);assert.equal(x.callbacks[1].options.maximumAge,0);x.stop()
})
test('permission denial stops polling and returning to the app retries', () => {
  const x=tracker();x.callbacks[0].bad({code:1});assert.equal(x.intervals.size,0)
  x.events['document:visibilitychange']();assert.equal(x.intervals.size,1);assert.equal(x.callbacks.length,2);x.stop()
})
test('tracker prevents overlapping GPS calls and sends nothing after cleanup', async () => {
  const x=tracker();x.intervals.values().next().value();assert.equal(x.callbacks.length,1)
  x.stop();await x.callbacks[0].ok({coords:{latitude:53,longitude:27}});assert.equal(x.sent.length,0);assert.equal(Object.keys(x.events).length,0)
})

test('a failed push registration never marks the device subscribed', async () => {
  const state=[];let index=0;const order=[]
  const previous=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY='test-only'
  try {
    const {usePushNotifications}=load('hooks/usePushNotifications.ts', {
      react:{useState:v=>{const i=index++;state[i]=i===0?true:v;return [state[i],next=>{state[i]=next}]},useEffect(){},useRef:v=>({current:v}),useCallback:fn=>fn},
      '@/lib/browser-push':{readyPushRegistration:async()=>{order.push('registration');return {pushManager:{getSubscription:async()=>({})}}},saveDevicePushSubscription:async()=>{throw Error('network failure')},vapidBytes:()=>new ArrayBuffer(1)},
    }, {Error, Notification:{requestPermission:()=>{order.push('permission');return Promise.resolve('granted')}}})
    assert.equal(await usePushNotifications('driver').subscribe(),false)
    assert.equal(state[1],false);assert.equal(state[2],false);assert.equal(state[3],'network failure');assert.deepEqual(order,['permission','registration'])
  } finally { if(previous===undefined)delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY=previous }
})
