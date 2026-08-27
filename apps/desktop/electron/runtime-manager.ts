import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { sanitizedChildEnv } from './env'

/**
 * DSH runtime lifecycle (ADR-004): the bundled tree under Resources/runtime is
 * a read-only template (never modified — keeps the app signature intact);
 * a working copy under userData is what the supervisor runs, and is the only
 * thing auto-updates touch. Upgrades happen in a staging copy with the
 * runtime's own bundled pnpm, validated, then swapped in atomically with a
 * one-level rollback kept as runtime-backup.
 */

const NPM_DIST_TAGS_URL = 'https://registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags'

export interface RuntimeStatus {
  state: 'idle' | 'checking' | 'updated' | 'skipped-major' | 'error' | 'reset'
  current: string | null
  latest: string | null
  note?: string
  updatedAt: number
}

export function bundledRuntimeDir(): string {
  return path.join(process.resourcesPath, 'runtime')
}

export function userRuntimeDir(): string {
  return path.join(app.getPath('userData'), 'runtime')
}

function userRuntimeBackupDir(): string {
  return path.join(app.getPath('userData'), 'runtime-backup')
}

function userRuntimeStagingDir(): string {
  return path.join(app.getPath('userData'), 'runtime-next')
}

/** The dsh CLI entry of the working copy (dev runs resolve from the workspace). */
export function resolveDshBin(): string {
  if (app.isPackaged) {
    return path.join(userRuntimeDir(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  }
  return require.resolve('@deepseek-ai/dsh/lib/bin.js')
}

export function runtimeVersion(dir: string): string | null {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8'),
    ) as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

/** Ensure the userData working copy exists (first boot copies the template). */
export function ensureRuntime(): string {
  const user = userRuntimeDir()
  if (existsSync(path.join(user, 'node_modules', '@deepseek-ai', 'dsh'))) return user
  mkdirSync(path.dirname(user), { recursive: true })
  cpSync(bundledRuntimeDir(), user, { recursive: true })
  return user
}

/** Reset the working copy back to the bundled template. */
export function resetRuntime(): void {
  rmSync(userRuntimeDir(), { recursive: true, force: true })
  rmSync(userRuntimeBackupDir(), { recursive: true, force: true })
  ensureRuntime()
}

export async function fetchLatestDshVersion(): Promise<string | null> {
  try {
    const res = await fetch(NPM_DIST_TAGS_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const tags = (await res.json()) as { latest?: string; next?: string }
    // DSH ships rc builds; prefer "latest", fall back to "next".
    return tags.latest ?? tags.next ?? null
  } catch {
    return null
  }
}

/**
 * Auto-update gate: only same-major versions upgrade without confirmation.
 * Prerelease suffixes (rc) are allowed — that is DSH's current channel.
 */
export function shouldAutoUpdate(current: string, target: string): boolean {
  return majorOf(current) === majorOf(target) && current !== target
}

function majorOf(version: string): number {
  return Number(version.replace(/^[\^~]?v?(\d+)\..*$/, '$1'))
}

function pnpmBin(runtimeDir: string): string {
  return path.join(runtimeDir, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
}

/** Boot-level validation: the staged dsh must at least start and print a version. */
function validateRuntime(dir: string): boolean {
  const bin = path.join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!existsSync(bin)) return false
  const result = spawnSync(process.execPath, ['--expose-internals', bin, '--version'], {
    env: { ...sanitizedChildEnv(), ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
    timeout: 60_000,
  })
  return result.status === 0 && /v?\d/.test(result.stdout ?? '')
}

/**
 * Upgrade the working copy to `version` via the staged-copy flow.
 * Returns a human-readable result for the status file.
 */
export function updateRuntime(version: string): { ok: boolean; note: string } {
  const staging = userRuntimeStagingDir()
  rmSync(staging, { recursive: true, force: true })
  try {
    cpSync(userRuntimeDir(), staging, { recursive: true })
    const install = spawnSync(
      process.execPath,
      [pnpmBin(staging), 'install', '--prod', '--ignore-workspace', `@deepseek-ai/dsh@${version}`],
      {
        cwd: staging,
        env: { ...sanitizedChildEnv(), ELECTRON_RUN_AS_NODE: '1' },
        encoding: 'utf8',
        timeout: 10 * 60_000,
      },
    )
    if (install.status !== 0) {
      return { ok: false, note: `pnpm install failed: ${(install.stderr ?? '').trim().slice(0, 300)}` }
    }
    const staged = runtimeVersion(staging)
    if (staged !== version) {
      return { ok: false, note: `staged version ${staged ?? 'null'} != requested ${version}` }
    }
    if (!validateRuntime(staging)) {
      return { ok: false, note: 'staged runtime failed dsh --version validation' }
    }
    // Atomic-ish swap with one-level rollback.
    rmSync(userRuntimeBackupDir(), { recursive: true, force: true })
    renameSync(userRuntimeDir(), userRuntimeBackupDir())
    renameSync(staging, userRuntimeDir())
    return { ok: true, note: `runtime updated to ${version} (previous kept as runtime-backup)` }
  } catch (err) {
    return { ok: false, note: `update failed: ${String(err).slice(0, 300)}` }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/** Persist status for the host plugin's /api/workbench/runtime-status route. */
export function writeRuntimeStatus(partial: Partial<RuntimeStatus>): void {
  const file = path.join(dshHomeDir(), 'workbench', 'runtime-status.json')
  const prev = readRuntimeStatus()
  const status: RuntimeStatus = {
    state: 'idle',
    current: runtimeVersion(app.isPackaged ? userRuntimeDir() : bundledRuntimeDir()),
    latest: null,
    updatedAt: Date.now(),
    ...prev,
    ...partial,
  }
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(status, null, 2))
  } catch {
    // Best-effort observability only.
  }
}

export function readRuntimeStatus(): RuntimeStatus | null {
  try {
    return JSON.parse(
      readFileSync(path.join(dshHomeDir(), 'workbench', 'runtime-status.json'), 'utf8'),
    ) as RuntimeStatus
  } catch {
    return null
  }
}

function dshHomeDir(): string {
  return process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
}
