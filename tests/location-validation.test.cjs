const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./load-app.cjs')
const { updateLocationSchema } = load('lib/api/validate.ts')
for (const value of [91, -91, 999, 'Infinity', 'NaN', '', ' ']) {
  test(`location rejects invalid latitude ${JSON.stringify(value)}`, () => {
    assert.equal(updateLocationSchema.safeParse({ latitude: value, longitude: 27 }).success, false)
  })
}
test('location accepts valid boundary and zero values', () => {
  const value = updateLocationSchema.parse({ latitude: '-90', longitude: 180, heading: 0, speed: 0 })
  assert.equal(value.latitude, -90)
  assert.equal(value.speed, 0)
})
for (const [code, expected] of [['42501', 403], ['22023', 400], ['XX000', 500]]) {
  test(`location maps ${code} without leaking database detail`, async () => {
    const route = load('app/api/driver/update-location/route.ts', {
      '@/lib/supabase/server': { createServerSupabaseClient: () => ({
        rpc: async (name) => { assert.equal(name, 'record_driver_location'); return { error: { code, message: 'private SQL detail' } } },
      }) },
      '@/lib/api/auth': { requireRole: async () => ({ ok: true, user: { id: 'driver' } }) },
    })
    const response = await route.POST(new Request('https://example.test/location', {
      method: 'POST', body: JSON.stringify({ latitude: 53, longitude: 27 }),
    }))
    assert.equal(response.status, expected)
    assert.equal((await response.text()).includes('private SQL detail'), false)
  })
}
