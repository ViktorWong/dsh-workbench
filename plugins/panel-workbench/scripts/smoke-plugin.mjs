// Artifact smoke: load the BUILT bundle (lib/index.mjs — exactly what ships
// in the tgz) and assert it exports a valid plugin whose apply() registers
// the tool and cleans up. Runtime integration under the real host is covered
// separately by profile boot (see apps/desktop WORKBENCH_SMOKE).
// Usage: node scripts/smoke-plugin.mjs   (exit 0 = pass)
const registered = []

const plugin = await import('../lib/index.mjs')
if (plugin.name !== 'workbench-panel') throw new Error('bad plugin name: ' + plugin.name)
if (!Array.isArray(plugin.inject) || !plugin.inject.includes('tools')) {
  throw new Error('inject must declare tools: ' + JSON.stringify(plugin.inject))
}

const cleanups = []
const ctx = {
  logger: { info: (...a) => console.log('[log]', ...a) },
  tools: { register: (t) => registered.push(t) },
  effect: (setup) => {
    const dispose = setup()
    cleanups.push(dispose)
    return dispose
  },
}
plugin.apply(ctx)

const tool = registered.find((t) => t.name === 'workbench_info')
if (!tool) throw new Error('workbench_info not registered; got: ' + registered.map((t) => t.name))
const out = await tool.execute({})
if (!out.includes('dsh-workbench panel: v') || !out.includes(`node: ${process.version}`)) {
  throw new Error('unexpected execute output: ' + out)
}
for (const dispose of cleanups) dispose()

console.log('PLUGIN_SMOKE_OK')
console.log(out)
process.exit(0)
