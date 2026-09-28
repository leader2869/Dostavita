const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./load-app.cjs')
const roles = ['client', 'customer', 'driver', 'fleet', 'admin', 'superadmin']
const id = '12345678-1234-4234-8234-123456789abc'
function dbFor(role) {
  const profile = role ? { id, role } : null
  return {
    auth: { getUser: async () => ({ data: { user: role ? { id } : null }, error: null }) },
    rpc(name) {
      assert.equal(name, 'get_user_profile', 'unauthorized request reached a business RPC')
      return { single: async () => ({ data: profile }) }
    },
    from(table) {
      assert.equal(table, 'profiles', 'unauthorized request reached business data')
      return { select() { return this }, eq() { return this }, single: async () => ({ data: profile }) }
    },
  }
}
const { requireRole, requireSuperadmin } = load('lib/api/auth.ts')
for (const role of roles) {
  test(`${role}: dashboard redirects to its own role landing page`, async () => {
    const expected = `/dashboard/${role === 'superadmin' ? 'admin' : role}`
    const { default: dashboard } = load('app/dashboard/page.tsx', {
      'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`) } },
      '@/lib/supabase/cached-auth': { getCachedUserAndProfile: async () => ({ user: { id }, profile: { role } }) },
    })
    await assert.rejects(dashboard(), { message: `redirect:${expected}` })
  })
  for (const allowed of ['client', 'customer', 'driver', 'admin', 'superadmin']) {
    test(`${role}: API role gate ${allowed}`, async () => {
      const result = await requireRole(dbFor(role), allowed)
      assert.equal(result.ok, role === allowed)
      if (!result.ok) assert.equal(result.response.status, 403)
    })
  }
  test(`${role}: superadmin-only gate`, async () => {
    const result = await requireSuperadmin(dbFor(role))
    assert.equal(result.ok, role === 'superadmin')
    if (!result.ok) assert.equal(result.response.status, 403)
  })
}
const endpoints = [
  ['customer/search-drivers', 'POST', ['customer'], {}],
  ['customer/attach-driver', 'POST', ['customer'], { driver_user_id: id }],
  ['customer/detach-driver', 'POST', ['customer'], { driver_user_id: id }],
  ['customer/create-driver', 'POST', ['customer'], { email: 'driver@example.test', password: 'test-only-password', full_name: 'Test', vehicle_type: 'car', license_number: 'test' }],
  ['customer/requests', 'GET', ['customer']],
  ['customer/requests/[id]/cancel', 'POST', ['customer'], {}],
  ['driver/requests', 'GET', ['driver']],
  ['driver/requests/[id]/respond', 'POST', ['driver'], { response: 'accepted' }],
  ['driver/reject-order', 'POST', ['driver'], { orderId: id }],
  ['driver/update-location', 'POST', ['driver'], { latitude: 53, longitude: 27 }],
  ['orders/[id]/cancel', 'POST', ['client', 'customer'], {}],
  ['orders/notify-drivers', 'POST', ['client', 'customer'], { orderId: id }],
  ['push/send', 'POST', ['admin', 'superadmin'], { userId: id, title: 'Test', body: 'Test' }],
  ['admin/delete-user', 'POST', ['superadmin'], { userId: id }],
  ['admin/update-user', 'POST', ['superadmin'], { userId: id }],
  ['admin/change-password', 'POST', ['superadmin'], { userId: id, password: 'test-password-1234' }],
  ['admin/reset-password', 'POST', ['superadmin'], { email: 'test@example.test' }],
]
for (const [endpoint, method, allowed, body] of endpoints) {
  for (const role of [null, ...roles.filter((role) => !allowed.includes(role))]) {
    test(`${role || 'anonymous'} denied ${method} ${endpoint} before business operations`, async () => {
      const db = dbFor(role)
      const route = load(`app/api/${endpoint}/route.ts`, {
        '@/lib/supabase/server': { createServerSupabaseClient: () => db },
        '@/lib/supabase/admin': { createAdminSupabaseClient: () => { throw new Error('unauthorized admin access') } },
      })
      const req = new Request(`https://example.test/api/${endpoint}`, {
        method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      })
      const result = await route[method](req, { params: { id } })
      assert.equal(result.status, role ? 403 : 401)
    })
  }
}
test('anonymous dashboard redirects to login', async () => {
  const { default: dashboard } = load('app/dashboard/page.tsx', {
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`) } },
    '@/lib/supabase/cached-auth': { getCachedUserAndProfile: async () => ({ user: null, profile: null }) },
  })
  await assert.rejects(dashboard(), { message: 'redirect:/login' })
})
