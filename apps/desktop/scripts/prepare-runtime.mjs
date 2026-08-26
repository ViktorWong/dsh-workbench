// Produces apps/desktop/runtime/ — a standalone production install of the
// dsh runtime (real files, no asar, no symlinks) that electron-builder ships
// via extraResources. The packaged app resolves dsh from there, so every
// module-resolution path behaves exactly like a normal node install.
// (See ADR-002 §6 item 8: asar-internal resolution breaks dsh's profile
// boot; the runtime dir sidesteps it and keeps packaging fast — no giant
// node-module collection into the asar.)
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const DSH_VERSION = '0.1.1-rc.2'

rmSync('runtime', { recursive: true, force: true })
mkdirSync('runtime')
writeFileSync(
  'runtime/package.json',
  `${JSON.stringify(
    {
      name: 'dsh-workbench-runtime',
      private: true,
      dependencies: { '@deepseek-ai/dsh': DSH_VERSION },
    },
    null,
    2,
  )}\n`,
)
// The dsh package family resolves siblings via a flat node_modules layout.
writeFileSync('runtime/.npmrc', 'node-linker=hoisted\n')

const result = spawnSync(
  'pnpm',
  // --ignore-workspace: runtime must be a standalone install, not a member
  // of the repo workspace (otherwise pnpm wants to purge/relink parent dirs).
  ['install', '--prod', '--ignore-workspace'],
  {
    cwd: 'runtime',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)
if (result.status !== 0) {
  console.error('prepare-runtime: pnpm install failed')
  process.exit(result.status ?? 1)
}
const bin = 'runtime/node_modules/@deepseek-ai/dsh/lib/bin.js'
if (!existsSync(bin)) {
  console.error(`prepare-runtime: ${bin} missing after install`)
  process.exit(1)
}
console.log('runtime ready at apps/desktop/runtime')
