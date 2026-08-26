import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

/** Bundles every workbench profile must compose, in order. */
const BASE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']

export function dshHome(): string {
  return process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
}

/**
 * ADR-002: install companion plugin tarballs from app resources into the
 * dedicated profile, then make sure the base bundles (dsh-base + dsh-web-app)
 * are composed. First `add` initializes the profile. Failures throw; callers
 * treat provisioning as non-fatal.
 */
export async function provisionProfile(profile: string): Promise<void> {
  for (const tgz of listBundledPlugins()) {
    runDshPlugin(['plugin', '--profile', profile, 'add', tgz])
  }
  ensureBaseBundles(profile)
}

/** Full reset of the workbench profile (user-facing "reset" action). */
export async function resetProfile(profile: string): Promise<void> {
  runDshPlugin(['plugin', '--profile', profile, 'remove', '--all'])
}

function listBundledPlugins(): string[] {
  // Packaged app: electron-builder copies resources/plugins here.
  // Dev run: apps/desktop/resources/plugins (populated by pnpm pack + copy).
  const candidates = [
    path.join(process.resourcesPath, 'plugins'),
    path.join(__dirname, '..', 'resources', 'plugins'),
  ]
  for (const dir of candidates) {
    if (!existsSync(dir)) continue
    const tgz = readdirSync(dir)
      .filter((f) => f.endsWith('.tgz'))
      .map((f) => path.join(dir, f))
    if (tgz.length > 0) return tgz
  }
  return []
}

/**
 * `dsh plugin add` initializes a profile with dsh-base only; the web app is a
 * separate built-in bundle (resolved from the dsh install dir, no pnpm dep).
 * Insert it right after dsh-base so the profile actually serves the web UI.
 */
function ensureBaseBundles(profile: string): void {
  const manifestPath = path.join(dshHome(), 'profiles', profile, 'package.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`profile manifest missing after provisioning: ${manifestPath}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dsh?: { profile?: { bundles?: string[] } }
  }
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles)) {
    throw new Error(`profile manifest has no bundles list: ${manifestPath}`)
  }
  let changed = false
  for (const bundle of [...BASE_BUNDLES].reverse()) {
    if (bundles.includes(bundle)) continue
    const baseIdx = bundles.indexOf('@deepseek-ai/dsh-base')
    bundles.splice(baseIdx + 1, 0, bundle)
    changed = true
  }
  if (changed) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

function runDshPlugin(args: string[]): void {
  const result = spawnSync(process.execPath, [resolveDshBin(), ...args], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`dsh ${args.join(' ')} failed: ${result.stderr?.trim() ?? result.status}`)
  }
}

export function resolveDshBin(): string {
  return require.resolve('@deepseek-ai/dsh/lib/bin.js')
}
