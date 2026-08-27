import { spawnSync } from 'node:child_process'
import { sanitizedChildEnv } from './env'
import { resolveDshBin } from './runtime-manager'
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
  const pluginDirs = listPluginDirs()
  const tarballs = pluginDirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.tgz'))
      .map((f) => path.join(dir, f)),
  )
  // Remove previously installed workbench plugins first: the profile manifest
  // references bundled tarballs by file: path, and re-adding while an older
  // tarball file is missing makes pnpm fail on re-resolution. Plugin names are
  // read from the manifest's dependencies — reversing pnpm pack's filename
  // mangling is ambiguous.
  for (const pkg of managedPluginNames(profile, pluginDirs)) {
    await runDshPlugin(['plugin', '--profile', profile, 'remove', pkg], { allowFail: true })
  }
  for (const tgz of tarballs) {
    // One retry: profile-dir pnpm runs can fail transiently when a previous
    // instance was killed mid-install (lock/store contention).
    await runDshPlugin(['plugin', '--profile', profile, 'add', tgz], { retries: 1 })
  }
  await ensureBaseBundles(profile)
}

/** Full reset of the workbench profile (user-facing "reset" action). */
export async function resetProfile(profile: string): Promise<void> {
  runDshPlugin(['plugin', '--profile', profile, 'remove', '--all'])
}

function listPluginDirs(): string[] {
  // Packaged app: electron-builder copies resources/plugins here.
  // Dev run: apps/desktop/resources/plugins (populated by pnpm pack + copy).
  const candidates = [
    path.join(process.resourcesPath, 'plugins'),
    path.join(__dirname, '..', 'resources', 'plugins'),
  ]
  return candidates.filter((dir) => existsSync(dir))
}

function managedPluginNames(profile: string, pluginDirs: string[]): string[] {
  const manifestPath = path.join(dshHome(), 'profiles', profile, 'package.json')
  if (!existsSync(manifestPath)) return []
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  return Object.entries(manifest.dependencies ?? {})
    .filter(([, value]) => value.startsWith('file:'))
    .filter(([, value]) => pluginDirs.some((dir) => value.includes(dir)))
    .map(([name]) => name)
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

async function runDshPlugin(
  args: string[],
  opts: { allowFail?: boolean; retries?: number } = {},
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const result = spawnSync(process.execPath, [resolveDshBin(), ...args], {
      env: { ...sanitizedChildEnv(), ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
    })
    if (result.status === 0) return
    if (attempt < (opts.retries ?? 0)) {
      // In-process sleep: never spawn another Electron instance for waiting
      // (without ELECTRON_RUN_AS_NODE it would launch the whole app).
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      continue
    }
    const err = new Error(
      `dsh ${args.join(' ')} failed (exit ${result.status})\n` +
        `stderr: ${result.stderr?.trim().slice(-800) ?? '(empty)'}\n` +
        `stdout: ${result.stdout?.trim().slice(-800) ?? '(empty)'}`,
    )
    if (opts.allowFail) return
    throw err
  }
}

