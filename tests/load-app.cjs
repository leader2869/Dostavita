const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Load application TypeScript with explicit dependency doubles; never contact Supabase or push providers.
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file)
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(js, {
    module, exports: module.exports, process, URL, console: { error() {} },
    require(name) {
      if (name in mocks) return mocks[name]
      if (name === 'server-only') return {}
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks)
      return require(name)
    },
  }, { filename })
  return module.exports
}


module.exports = { load }
