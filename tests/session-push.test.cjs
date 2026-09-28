const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { NextRequest } = require('next/server')

// Load application TypeScript with explicit dependency doubles; never contact Supabase or push providers.
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file)
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(js, {
    module, exports: module.exports, process, console: { error() {} },
    require(name) {
      if (name in mocks) return mocks[name]
      if (name === 'server-only') return {}
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks)
      return require(name)
    },
  }, { filename })
  return module.exports
}

const id = '12345678-1234-4234-8234-123456789abc'
function request(body = { orderId: id, orderNumber: 42, finalPrice: '10' }) {
  return new Request('https://example.test/api/orders/notify-drivers', {
    method: 'POST', body: JSON.stringify(body),
  })
}
function harness(overrides = {}, route = 'app/api/orders/notify-drivers/route.ts') {
  const calls = { admin: 0, sent: [], filters: [] }
  const order = { id, customer_id: 'owner', status: 'searching_courier', visibility: 'public', order_number: 42, final_price: 10, ...overrides.order }
  const admin = { from(table) {
    const query = {
      select() { return query },
      eq(column, value) {
        calls.filters.push([table, column, value])
        return query
      },
      then(resolve, reject) {
        const result = table === 'order_rejections'
          ? { data: [{ driver_user_id: 'rejected' }], error: overrides.rejectionError }
          : { data: [{ user_id: 'driver', endpoint: 'allowed' }, { user_id: 'rejected', endpoint: 'excluded' }], error: null }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return query
  } }
  const handler = load(route, {
    '@/lib/supabase/server': { createServerSupabaseClient: () => ({ from() {
      return { select() { return this }, eq() { return this }, single: async () => ({ data: order, error: null }) }
    } }) },
    '@/lib/api/auth': { requireRole: async () => overrides.auth || ({ ok: true, user: { id: 'owner' } }) },
    '@/lib/supabase/admin': { createAdminSupabaseClient: () => { calls.admin++; return admin } },
    '@/lib/push': {
      configurePush: () => overrides.configured !== false,
      sendPush: async (_, recipients, payload) => {
        calls.sent.push({ recipients, payload })
        return { sent: recipients.length, failed: 0, total: recipients.length }
      },
    },
  }).POST
  return { handler, calls }
}

test('legacy numeric order number is accepted; price and number come from database', async () => {
  const { handler, calls } = harness()
  assert.equal((await handler(request({ orderId: id, orderNumber: 999, finalPrice: 999 }))).status, 200)
  assert.equal(calls.sent[0].payload.body, 'Заказ №42 - 10 BYN')
  assert.equal(calls.sent[0].recipients.length, 1)
  assert.equal(calls.sent[0].recipients[0].user_id, 'driver')
  assert.ok(calls.filters.some((f) => f[0] === 'push_subscriptions' && f[1] === 'profiles.role' && f[2] === 'driver'))
})
for (const [name, overrides, expected] of [
  ['anonymous request', { auth: { ok: false, response: new Response(null, { status: 401 }) } }, 401],
  ['wrong role', { auth: { ok: false, response: new Response(null, { status: 403 }) } }, 403],
  ['another creator', { order: { customer_id: 'someone-else' } }, 403],
  ['assigned order', { order: { visibility: 'assigned' } }, 400],
  ['completed order', { order: { status: 'completed' } }, 400],
  ['missing push configuration', { configured: false }, 503],
]) {
  test(`${name} cannot access privileged subscriptions`, async () => {
    const { handler, calls } = harness(overrides)
    assert.equal((await handler(request())).status, expected)
    assert.equal(calls.admin, 0)
    assert.equal(calls.sent.length, 0)
  })
}
test('invalid order ID is rejected before privileged access', async () => {
  const { handler, calls } = harness()
  assert.equal((await handler(request({ orderId: 'bad' }))).status, 400)
  assert.equal(calls.admin, 0)
})
test('failed rejection lookup stops delivery instead of contacting excluded drivers', async () => {
  const { handler, calls } = harness({ rejectionError: { message: 'database failure' } })
  assert.equal((await handler(request())).status, 500)
  assert.equal(calls.sent.length, 0)
})
test('admin send scopes subscriptions to the requested user', async () => {
  const { handler, calls } = harness({}, 'app/api/push/send/route.ts')
  assert.equal((await handler(request({ userId: id, title: 'Hello', body: 'Message' }))).status, 200)
  assert.ok(calls.filters.some((f) => f[1] === 'user_id' && f[2] === id))
})
test('admin send rejects malformed data before privileged access', async () => {
  const { handler, calls } = harness({}, 'app/api/push/send/route.ts')
  assert.equal((await handler(request({ title: 'Hello' }))).status, 400)
  assert.equal(calls.admin, 0)
})
test('delivery removes expired subscriptions, keeps transient failures, exposes only counts', async () => {
  const deleted = []
  const { sendPush } = load('lib/push.ts', {
    'web-push': { sendNotification: async ({ endpoint }) => {
      if (endpoint !== 'ok') throw { statusCode: endpoint === 'expired' ? 410 : 503 }
    } },
  })
  const result = await sendPush({ from: () => ({ delete: () => ({ eq: async (_, endpoint) => { deleted.push(endpoint); return { error: null } } }) }) },
    ['ok', 'expired', 'temporary'].map((endpoint) => ({ endpoint, p256dh_key: 'secret', auth_key: 'secret' })), {})
  assert.equal(JSON.stringify(result), JSON.stringify({ sent: 1, failed: 2, total: 3 }))
  assert.deepEqual(deleted, ['expired'])
})
test('middleware propagates refreshed cookies to request and browser response', async () => {
  const { updateSession } = load('lib/supabase/middleware.ts', {
    '@/lib/config': { getSupabaseClientEnv: () => ({ url: 'https://example.test', anonKey: 'test' }) },
    '@supabase/ssr': { createServerClient: (_, __, { cookies }) => ({ auth: { getUser: async () => {
      cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true, path: '/' } }])
      return { data: { user: { id: 'user' } } }
    } } }) },
  })
  const req = new NextRequest('https://example.test/dashboard')
  const response = await updateSession(req)
  assert.equal(req.cookies.get('session').value, 'refreshed')
  assert.equal(response.cookies.get('session').value, 'refreshed')
  assert.equal(response.cookies.get('session').httpOnly, true)
  assert.match(response.headers.get('x-middleware-request-cookie'), /session=refreshed/)
})
