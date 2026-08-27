import { type ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import * as net from 'node:net'
import { sanitizedChildEnv } from './provisioning'

export interface SupervisorOptions {
  /** Absolute path of the dsh CLI entry (lib/bin.js). */
  dshBin: string
  profile: string
  preferredPort: number
  /** How the child process is spawned (Electron passes execPath + ELECTRON_RUN_AS_NODE). */
  spawnOptions?: {
    execPath: string
    env?: Record<string, string>
  }
  pollIntervalMs?: number
  pollTimeoutMs?: number
  maxRestarts?: number
}

export interface ReadyEvent {
  url: string
  port: number
}

/**
 * Extracts the service URL from dsh stdout. dsh prints a line like:
 *   dsh web: http://127.0.0.1:3999
 * The port may differ from the requested one when --port 0 was passed.
 */
export function parseServiceUrl(chunk: string): string | null {
  const match = chunk.match(/https?:\/\/[^\s'"]+/)
  return match?.[0] ?? null
}

export function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, host)
  })
}

/**
 * Manages the `dsh web` child process lifecycle:
 * spawn -> read the printed service URL -> health poll -> ready |
 * crash (backoff restart) -> graceful stop (SIGTERM, SIGKILL fallback).
 * See ADR-001 §2; the required test matrix lives in the dsh-qa agent spec.
 */
export class DshSupervisor extends EventEmitter {
  private child: ChildProcess | null = null
  private readonly dshBin: string
  private readonly profile: string
  private readonly preferredPort: number
  private readonly spawnEnv: Record<string, string>
  private readonly spawnExecPath: string
  private readonly pollIntervalMs: number
  private readonly pollTimeoutMs: number
  private readonly maxRestarts: number
  private restartCount = 0
  private stopping = false

  constructor(opts: SupervisorOptions) {
    super()
    this.dshBin = opts.dshBin
    this.profile = opts.profile
    this.preferredPort = opts.preferredPort
    this.spawnEnv = opts.spawnOptions?.env ?? {}
    this.spawnExecPath = opts.spawnOptions?.execPath ?? process.execPath
    this.pollIntervalMs = opts.pollIntervalMs ?? 500
    this.pollTimeoutMs = opts.pollTimeoutMs ?? 30_000
    this.maxRestarts = opts.maxRestarts ?? 5
  }

  async start(): Promise<ReadyEvent> {
    const port = (await isPortFree(this.preferredPort))
      ? this.preferredPort
      : 0 // 0 lets the OS pick a free port; actual port comes from stdout
    const url = await this.spawnAndWait(port)
    const actualPort = portOf(url) ?? port
    this.emit('ready', { url, port: actualPort })
    return { url, port: actualPort }
  }

  stop(): void {
    this.stopping = true
    const child = this.child
    this.child = null
    if (!child || child.exitCode !== null) return
    child.kill('SIGTERM')
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, 5_000).unref()
  }

  private spawnAndWait(port: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false
      let url: string | null = null

      // Boot the dedicated profile directly (NOT the `web` subcommand —
      // `web` is an alias that rejects a parent --profile). App flags
      // (--host/--port/--no-open) are forwarded to the booted web app.
      // --expose-internals is required by dsh-base's HMR plugin when the
      // process is spawned directly instead of via the dsh shell wrapper.
      const child = spawn(
        this.spawnExecPath,
        [
          '--expose-internals',
          this.dshBin,
          '--profile',
          this.profile,
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--no-open',
        ],
        {
          // Strip our launcher's workspace env so dsh's own pnpm calls (plugin
          // loader) never mistake the profile dir for our repo workspace.
          env: { ...sanitizedChildEnv(), ...this.spawnEnv },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )

      const onChunk = (buf: Buffer): void => {
        const text = buf.toString('utf8')
        process.stdout.write(`[dsh] ${text}`)
        url ??= parseServiceUrl(text)
        if (url && !settled) {
          settled = true
          const serviceUrl = url
          void this.waitUntilHealthy(serviceUrl).then(
            () => resolve(serviceUrl),
            (err) => reject(err),
          )
        }
      }
      child.stdout?.on('data', onChunk)
      child.stderr?.on('data', onChunk)

      child.once('exit', (code) => {
        this.child = null
        if (settled) {
          if (this.stopping) return
          this.scheduleRestart(code)
          if (!url) reject(new Error(`dsh exited before printing its URL (code ${code})`))
          return
        }
        reject(new Error(`dsh exited before becoming healthy (code ${code})`))
        this.scheduleRestart(code)
      })

      this.child = child
    })
  }

  private scheduleRestart(code: number | null): void {
    if (this.stopping) return
    if (this.restartCount >= this.maxRestarts) {
      this.emit('crashed', { code, restarts: this.restartCount })
      return
    }
    this.restartCount += 1
    const backoffMs = Math.min(1_000 * 2 ** (this.restartCount - 1), 30_000)
    setTimeout(() => {
      void this.start().catch((err) => this.emit('error', err))
    }, backoffMs).unref()
  }

  private async waitUntilHealthy(url: string): Promise<void> {
    const deadline = Date.now() + this.pollTimeoutMs
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}/`)
        if (res.ok) return
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs))
    }
    throw new Error(`dsh service did not become healthy at ${url}`)
  }
}

function portOf(url: string): number | null {
  const match = url.match(/:(\d+)\/?$/)
  return match?.[1] ? Number(match[1]) : null
}
