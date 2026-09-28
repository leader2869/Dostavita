const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function page(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name in mocks ? mocks[name] : require(name),
  })
  return module.exports.default
}

for (const fails of [false, true]) {
  test(`user directory starts loading on mount and ${fails ? 'exposes failure' : 'shows returned users'}`, async () => {
    const state = [], effects = []
    let calls = 0
    const rows = [{ id: 'one', role: 'driver', email: 'driver@example.test' }]
    const Page = page('app/dashboard/admin/users/page.tsx', {
      react: { ...React,
        useState(initial) { const index = state.length; state.push(initial); return [initial, value => { state[index] = value }] },
        useCallback: fn => fn,
        useEffect: fn => effects.push(fn),
      },
      'next/navigation': { useRouter: () => ({ push() { throw Error('unexpected redirect') } }) },
      '@/lib/supabase/client': { createClient: () => ({ rpc: async name => {
        calls++; assert.equal(name, 'get_all_users')
        return fails ? { error: { message: 'Network failure' } } : { data: rows }
      } }) },
      '@/contexts/DashboardAuthContext': { useDashboardUser: () => ({ profile: { role: 'superadmin' } }) },
      '@/components/ui/BackButton': { BackButton: () => null },
      '@/lib/utils/toast': { toastSuccess() {} },
    })
    Page()
    for (const effect of effects) effect()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls, 1)
    assert.equal(state[1], false, 'loading must finish')
    if (fails) assert.ok(state.includes('Network failure'))
    else assert.equal(state[0], rows)
  })
}

async function personnel({ role = 'superadmin', fail = false } = {}) {
  let calls = 0
  const query = {
    select(columns) { assert.ok(columns.includes('vehicle_number')); return this },
    eq(key, value) { assert.equal(key, 'role'); assert.equal(value, 'driver'); return this },
    async order() { return fail ? { data: null, error: { message: 'denied' } } : {
      data: [{ id: 'profile-driver', full_name: 'Profile Driver', email: 'driver@example.test', vehicle_type: 'car', vehicle_number: 'TEST-42' }], error: null,
    } },
  }
  const Page = page('app/dashboard/admin/personnel/page.tsx', {
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ from(table) {
      calls++; assert.equal(table, 'profiles', 'must not read the empty legacy drivers table'); return query
    } }) },
    '@/lib/supabase/cached-auth': { getCachedUserAndProfile: async () => ({ user: role ? { id: 'actor' } : null, profile: role ? { role } : null }) },
    'next/navigation': { redirect: url => { throw Error(`redirect:${url}`) } },
    '@/components/ui/BackButton': { BackButton: () => null },
  })
  try { return { html: renderToStaticMarkup(await Page()), calls } }
  catch (error) { return { error, calls } }
}
for (const role of ['admin', 'superadmin']) {
  test(`${role} sees profile-only personnel without legacy rating or shift fields`, async () => {
    const result = await personnel({ role })
    assert.ifError(result.error)
    assert.match(result.html, /Profile Driver/)
    assert.match(result.html, /TEST-42/)
    assert.doesNotMatch(result.html, /Нет водителей/)
  })
}
test('personnel query failure is visibly different from an empty directory', async () => {
  const { html } = await personnel({ fail: true })
  assert.match(html, /role="alert"/)
  assert.match(html, /Не удалось загрузить персонал/)
  assert.doesNotMatch(html, /Нет водителей/)
})
for (const role of [null, 'client', 'customer', 'driver', 'fleet']) {
  test(`${role || 'anonymous'} cannot query personnel`, async () => {
    const { error, calls } = await personnel({ role })
    assert.match(error.message, /^redirect:/)
    assert.equal(calls, 0)
  })
}
