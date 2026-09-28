const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { renderToStaticMarkup } = require('react-dom/server')
const id = '12345678-1234-4234-8234-123456789abc'
async function render(role, failBalance = false) {
  const calls = []
  const profile = { id, role, full_name: 'Test User', email: 'user@example.test', created_at: '2026-01-01', organization_id: role === 'driver' ? 'company' : null }
  function from(table) {
    calls.push(table)
    let target
    const query = {
      select() { return this }, eq(key, value) { if (key === 'id') target = value; return this }, order() { return this }, limit() { return this },
      then(resolve, reject) {
        const result = table === 'profiles' ? { data: target === 'company' ? { organization_name: 'Actual Company', email: 'company@example.test' } : profile } : table === 'balances' ? (failBalance ? { error: { message: 'unavailable' } } : { data: { amount: 125.5, currency: 'BYN' } }) : { data: [] }
        return Promise.resolve(result).then(resolve, reject)
      }, maybeSingle() { return this },
    }
    return query
  }
  const filename = 'app/dashboard/admin/users/[id]/page.tsx'
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  const mocks = {
    'next/navigation': { notFound() { throw Error('notFound') }, redirect() { throw Error('redirect') } },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ from }) },
    '@/lib/api/auth': { requireSuperadmin: async () => ({ ok: true }) },
    '@/components/ui/BackButton': { BackButton: () => null },
    '@/components/admin/ChangePasswordForm': { ChangePasswordForm: () => null },
    '@/lib/constants': { ORDER_STATUS_LABELS: {} },
  }
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name) })
  return { html: renderToStaticMarkup(await module.exports.default({ params: Promise.resolve({ id }) })), calls }
}
for (const role of ['client', 'customer', 'driver', 'fleet', 'admin', 'superadmin']) {
  test(`${role} user card shows balance and transaction history`, async () => {
    const { html, calls } = await render(role)
    assert.match(html, /125,50 BYN/)
    assert.ok(calls.includes('transactions'))
    if (role === 'driver') assert.match(html, /Actual Company/)
  })
}
test('balance error never appears as zero funds', async () => {
  const { html } = await render('client', true)
  assert.match(html, /Не удалось загрузить баланс/)
  assert.doesNotMatch(html, /0,00 BYN/)
})
