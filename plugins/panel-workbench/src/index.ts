import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { PLUGIN_VERSION } from './version'

export const name = 'workbench-panel'

export const inject = ['tools', 'webServer']

/** Provider-reported usage for one step (token-meter's bucket semantics). */
export interface UsageSample {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** The usage a session event reports for its step, if any. */
export function usageOf(event: UsageEvent): UsageSample | undefined {
  if (event.type === 'assistant/chunk' && event.data?.chunk?.type === 'usage') {
    return event.data.chunk.usage
  }
  if (event.type === 'assistant/message') return event.data?.usage
  return undefined
}

interface UsageEvent {
  type: string
  turn?: number
  step?: number
  data?: {
    usage?: UsageSample
    chunk?: { type: string; usage?: UsageSample }
  }
}

export interface DayTotals {
  /** uncached input */ i: number
  /** output */ o: number
  /** cache read */ cr: number
  /** cache write */ cw: number
}

interface Store {
  days: Record<string, DayTotals>
  /** Latest sample per session/turn/step — replacement semantics. */
  samples: Record<string, { date: string; usage: UsageSample }>
}

export const todayKey = (now = new Date()): string => now.toISOString().slice(0, 10)

const zeroDay = (): DayTotals => ({ i: 0, o: 0, cr: 0, cw: 0 })

/**
 * Daily usage ledger: folds provider-reported usage from session events into
 * per-day buckets with same-key replacement (a later sample for the same
 * session/turn/step replaces the earlier one instead of adding again — the
 * same invariant dsh-token-meter relies on). Persisted as JSON, debounced.
 */
export class DailyUsageLedger {
  private store: Store = { days: {}, samples: {} }
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(private readonly file: string) {
    try {
      if (existsSync(file)) {
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Store>
        this.store.days = parsed.days ?? {}
        this.store.samples = parsed.samples ?? {}
      }
    } catch {
      // Corrupt ledger: start fresh rather than failing the plugin.
      this.store = { days: {}, samples: {} }
    }
  }

  /** Record the latest usage sample for one session/turn/step. */
  record(sessionKey: string, turn: number | undefined, step: number | undefined, usage: UsageSample): void {
    if (this.disposed) return
    if (typeof usage.inputTokens !== 'number' || typeof usage.outputTokens !== 'number') return
    const key = `${sessionKey}/${turn ?? 't'}/${step ?? 's'}`
    const date = todayKey()
    const prev = this.store.samples[key]
    if (prev) {
      const day = (this.store.days[prev.date] ??= zeroDay())
      day.i -= prev.usage.inputTokens
      day.o -= prev.usage.outputTokens
      day.cr -= prev.usage.cacheReadTokens ?? 0
      day.cw -= prev.usage.cacheWriteTokens ?? 0
    }
    const day = (this.store.days[date] ??= zeroDay())
    day.i += usage.inputTokens
    day.o += usage.outputTokens
    day.cr += usage.cacheReadTokens ?? 0
    day.cw += usage.cacheWriteTokens ?? 0
    this.store.samples[key] = { date, usage }
    this.scheduleFlush()
  }

  /** Per-day series for the last `count` days, oldest first, gap-filled. */
  series(count = 14): Array<{ date: string } & DayTotals> {
    const out: Array<{ date: string } & DayTotals> = []
    const now = new Date()
    for (let k = count - 1; k >= 0; k -= 1) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - k)
      const key = todayKey(d)
      const totals = this.store.days[key] ?? zeroDay()
      out.push({ date: key, ...totals })
    }
    return out
  }

  totals(): DayTotals {
    const t = zeroDay()
    for (const day of Object.values(this.store.days)) {
      t.i += day.i
      t.o += day.o
      t.cr += day.cr
      t.cw += day.cw
    }
    return t
  }

  private scheduleFlush(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, 2_000)
    this.timer.unref?.()
  }

  flush(): void {
    if (this.disposed) return
    try {
      mkdirSync(path.dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify(this.store))
    } catch {
      // Persistence is best-effort; losing a day of counters is acceptable.
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) clearTimeout(this.timer)
    this.flush()
  }
}

function dshHome(): string {
  return process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
}

/** The shell writes this file from its runtime auto-update checks (ADR-004). */
function readRuntimeStatus(): unknown {
  try {
    return JSON.parse(
      readFileSync(path.join(dshHome(), 'workbench', 'runtime-status.json'), 'utf8'),
    )
  } catch {
    return { state: 'unknown' }
  }
}

/**
 * Diagnostics tool: when a user reports an issue, the agent can call this to
 * capture a snapshot of the workbench environment (runtime, versions, uptime)
 * without shell access. Output schema is plain strings so it renders in any
 * client.
 */
const bootedAt = Date.now()
const workbenchInfo = defineTool({
  name: 'workbench_info',
  description:
    'Get a diagnostic snapshot of the dsh-workbench environment: runtime versions, platform, profile home and uptime. Use it when investigating environment-related issues.',
  parameters: {},
  output: {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  async execute() {
    const lines = [
      `dsh-workbench panel: v${PLUGIN_VERSION}`,
      `node: ${process.version}`,
      `platform: ${process.platform} (${process.arch})`,
      `dsh home: ${process.env.DSH_HOME ?? '~/.dsh (default)'}`,
      `uptime: ${Math.round((Date.now() - bootedAt) / 1000)}s`,
      `pid: ${process.pid}`,
    ]
    return lines.join('\n')
  },
})

interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: unknown, res: {
    setHeader: (k: string, v: string) => void
    end: (body: string) => void
  }) => void | Promise<void>
}

export function apply(ctx: Context): void {
  // stdout probe: lands in the shell's forwarded dsh output (smoke evidence).
  console.log('[workbench-panel] host apply: start')
  ctx.tools.register(workbenchInfo)

  const ledger = new DailyUsageLedger(path.join(dshHome(), 'workbench', 'usage-daily.json'))

  const offEvents = ctx.on('session/event', (session: object, event: SessionEvent) => {
    const usage = usageOf(event as unknown as UsageEvent)
    if (!usage) return
    const sessionKey = String((session as { id?: unknown }).id ?? 's')
    const typed = event as unknown as UsageEvent
    ledger.record(sessionKey, typed.turn, typed.step, usage)
  })

  const offRoute = (ctx as Context & { webServer: { register: (r: WebRoute) => () => void } }).webServer.register({
    kind: 'exact',
    path: '/api/workbench/usage-daily',
    handler: (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ series: ledger.series(14), totals: ledger.totals() }))
    },
  })

  const offStatusRoute = (ctx as Context & { webServer: { register: (r: WebRoute) => () => void } }).webServer.register({
    kind: 'exact',
    path: '/api/workbench/runtime-status',
    handler: (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(readRuntimeStatus()))
    },
  })

  ctx.effect(() => {
    return () => {
      offEvents()
      offRoute()
      offStatusRoute()
      ledger.dispose()
    }
  })

  ctx.effect(() => {
    ctx.logger.info('[workbench-panel] loaded, tool workbench_info registered, usage-daily route served')
    return () => ctx.logger.info('[workbench-panel] unloaded')
  })
}
