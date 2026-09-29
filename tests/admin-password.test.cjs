const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./load-app.cjs')
const id = '12345678-1234-4234-8234-123456789abc'
function handler(error = null, failConfig = false) {
  const calls = []
  const { POST } = load('app/api/admin/change-password/route.ts', {
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({}) },
    '@/lib/api/auth': { requireSuperadmin: async () => ({ ok: true, user: { id } }) },
    '@/lib/supabase/admin': { createAdminSupabaseClient() {
      if (failConfig) throw Error('private config')
      return { auth: { admin: { updateUserById: async (...args) => { calls.push(args); return { error } } } } }
    } },
  })
  return { POST, calls }
}
const request = (body, origin = 'https://example.test') => new Request('https://example.test/api/admin/change-password', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
test('superadmin changes only the requested user password and response contains no secret', async () => {
  const { POST, calls } = handler()
  const password = 'new-password-12345'
  const result = await POST(request({ userId: id, password }))
  assert.equal(result.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], id)
  assert.equal(calls[0][1].password, password)
  assert.equal(Object.keys(calls[0][1]).join(','), 'password')
  assert.equal((await result.text()).includes(password), false)
})
for (const body of [{ userId: id, password: 'short' }, { userId: 'wrong', password: 'new-password-12345' }, { userId: id, password: 'a'.repeat(129) }]) {
  test(`invalid password request rejected: ${body.password.length} chars`, async () => {
    const { POST, calls } = handler()
    assert.equal((await POST(request(body))).status, 400)
    assert.equal(calls.length, 0)
  })
}
test('cross-origin password change rejected before mutation', async () => {
  const { POST, calls } = handler()
  assert.equal((await POST(request({ userId: id, password: 'new-password-12345' }, 'https://foreign.test'))).status, 403)
  assert.equal(calls.length, 0)
})
test('configured public origin works behind a proxy without trusting forwarded headers', async () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.dostavita.by'
  try {
    const { POST, calls } = handler()
    const makeRequest = (origin) => new Request('http://localhost:3000/api/admin/change-password', {
      method: 'POST', headers: { origin, 'x-forwarded-host': 'foreign.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, password: 'new-password-12345' }),
    })
    assert.equal((await POST(makeRequest('https://www.dostavita.by'))).status, 200)
    assert.equal((await POST(makeRequest('https://foreign.test'))).status, 403)
    assert.equal(calls.length, 1)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = previous
  }
})
for (const failConfig of [false, true]) {
  test(`password failure does not expose internal error (${failConfig})`, async () => {
    const { POST } = handler({ message: 'private upstream error' }, failConfig)
    const response = await POST(request({ userId: id, password: 'new-password-12345' }))
    assert.equal(response.status, failConfig ? 500 : 400)
    assert.doesNotMatch(await response.text(), /private|new-password/)
  })
}
