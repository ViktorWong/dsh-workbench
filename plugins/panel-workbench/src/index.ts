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
    [key: string]: unknown
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
      this.store = { days: {}, samples: {} }
    }
  }

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

  series(count = 14): Array<{ date: string } & DayTotals> {
    const out: Array<{ date: string } & DayTotals> = []
    const now = new Date()
    for (let k = count - 1; k >= 0; k -= 1) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - k)
      const key = todayKey(d)
      out.push({ date: key, ...(this.store.days[key] ?? zeroDay()) })
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
      // Persistence is best-effort
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) clearTimeout(this.timer)
    this.flush()
  }
}

// ---------------------------------------------------------------------------
// Activity ring buffer: recent tool/approval events for the timeline view.
// ---------------------------------------------------------------------------

export interface ActivityEvent {
  ts: number
  sessionKey: string
  kind: 'tool' | 'approval' | 'session' | 'file'
  /** Tool name, approval action, or session state */
  label: string
  /** Duration in ms (tool calls only) */
  ms?: number
  ok?: boolean
}

export class ActivityRing {
  private buf: ActivityEvent[] = []
  private readonly max: number

  constructor(max = 200) {
    this.max = max
  }

  push(ev: ActivityEvent): void {
    this.buf.push(ev)
    if (this.buf.length > this.max) this.buf.splice(0, this.buf.length - this.max)
  }

  /** Most recent `count` events, newest first. */
  recent(count = 100): ActivityEvent[] {
    return this.buf.slice(-count).reverse()
  }
}

/** Extract activity-worthy info from a session event, or null. */
export function activityOf(sessionKey: string, event: UsageEvent, now = Date.now()): ActivityEvent | null {
  if (event.type === 'tool/call') {
    const tool = (event.data as { tool?: string } | undefined)?.tool
    return { ts: now, sessionKey, kind: 'tool', label: String(tool ?? 'unknown'), ok: true }
  }
  if (event.type === 'tool/result') {
    const data = event.data as { tool?: string; ok?: boolean; ms?: number } | undefined
    return {
      ts: now,
      sessionKey,
      kind: 'tool',
      label: String(data?.tool ?? 'unknown'),
      ms: typeof data?.ms === 'number' ? data.ms : undefined,
      ok: data?.ok !== false,
    }
  }
  if (event.type === 'approval/request') {
    const action = (event.data as { action?: string } | undefined)?.action
    return { ts: now, sessionKey, kind: 'approval', label: String(action ?? 'unknown') }
  }
  return null
}

// ---------------------------------------------------------------------------
// Subagent model configuration: read/write the profile's cordis.patch.yml
// to set tool-subagent's agentOptions (provider + model).
// ---------------------------------------------------------------------------

export interface SubagentModelConfig {
  provider: string
  model: string
  /** null = inherit parent session's model (DSH default) */
  maxTokens?: number
}

function profilePatchPath(): string {
  return path.join(dshHome(), 'profiles', 'dsh-workbench', 'cordis.patch.yml')
}

function parseProfilePatch(): string {
  try {
    return readFileSync(profilePatchPath(), 'utf8')
  } catch {
    return ''
  }
}

/** Read the current subagent model override from the profile patch. */
export function readSubagentModel(): SubagentModelConfig | null {
  const patch = parseProfilePatch()
  // Simple YAML scan: look for agentOptions under tool-subagent
  const match = patch.match(/tool-subagent[\s\S]*?agentOptions:[\s\S]*?provider:\s*(\S+)[\s\S]*?model:\s*(\S+)/)
  if (!match) return null
  return { provider: match[1] ?? '', model: match[2] ?? '' }
}

/**
 * Write the subagent model override into the profile patch.
 * Sets tool-subagent config.agentOptions so child agents use this model.
 * Pass null to remove the override (revert to parent inheritance).
 */
export function writeSubagentModel(config: SubagentModel | null): void {
  const patchPath = profilePatchPath()
  const patch = parseProfilePatch()

  // Strip the header comment to work with pure content; re-add later
  const headerMatch = patch.match(/^(#[^\n]*\n)*?/)
  const header = headerMatch ? headerMatch[0] : ''
  let content = patch.slice(header.length).trim()

  if (config === null) {
    content = '[]'
  } else {
    const block = [
      "- id: tool-subagent",
      "  name: '@deepseek-ai/dsh-tool-subagent'",
      '  config:',
      '    agentOptions:',
      `      provider: ${config.provider}`,
      `      model: ${config.model}`,
    ].join('\n')

    if (content.includes('id: tool-subagent')) {
      content = content.replace(
        /- id: tool-subagent\n{2}name: '@deepseek-ai\/dsh-tool-subagent'\n{2}config:\n{4}agentOptions:\n{6}provider: \S+\n{6}model: \S+/,
        block,
      )
    } else if (content === '[]' || content === '') {
      content = block
    } else {
      content = content.replace(/\]$/, '').trimEnd() + '\n' + block
    }
  }

  mkdirSync(path.dirname(patchPath), { recursive: true })
  writeFileSync(patchPath, header + content + '\n')
  // Signal the shell to restart dsh for the config to take effect
  const signalPath = path.join(dshHome(), 'workbench', 'restart-signal')
  mkdirSync(path.dirname(signalPath), { recursive: true })
  writeFileSync(signalPath, String(Date.now()))
}

type SubagentModel = SubagentModelConfig

// ---------------------------------------------------------------------------
// Host plugin
// ---------------------------------------------------------------------------

function dshHome(): string {
  return process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
}

/** The shell writes this file from its runtime auto-update checks (ADR-004). */
function readRuntimeStatus(): unknown {
  try {
    return JSON.parse(readFileSync(path.join(dshHome(), 'workbench', 'runtime-status.json'), 'utf8'))
  } catch {
    return { state: 'unknown' }
  }
}

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
    return [
      `dsh-workbench panel: v${PLUGIN_VERSION}`,
      `node: ${process.version}`,
      `platform: ${process.platform} (${process.arch})`,
      `dsh home: ${process.env.DSH_HOME ?? '~/.dsh (default)'}`,
      `uptime: ${Math.round((Date.now() - bootedAt) / 1000)}s`,
      `pid: ${process.pid}`,
    ].join('\n')
  },
})

interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (
    req: unknown,
    res: { setHeader: (k: string, v: string) => void; end: (body: string) => void },
  ) => void | Promise<void>
}

export function apply(ctx: Context): void {
  console.log('[workbench-panel] host apply: start')
  ctx.tools.register(workbenchInfo)

  const ledger = new DailyUsageLedger(path.join(dshHome(), 'workbench', 'usage-daily.json'))
  const activity = new ActivityRing(200)

  const offEvents = ctx.on('session/event', (session: object, event: SessionEvent) => {
    const typed = event as unknown as UsageEvent
    // Token usage folding
    const usage = usageOf(typed)
    if (usage) {
      const sessionKey = String((session as { id?: unknown }).id ?? 's')
      ledger.record(sessionKey, typed.turn, typed.step, usage)
    }
    // Activity timeline
    const sessionKey = String((session as { id?: unknown }).id ?? 's')
    const activityEv = activityOf(sessionKey, typed)
    if (activityEv) activity.push(activityEv)
  })

  const registerRoute = (ctx as Context & { webServer: { register: (r: WebRoute) => () => void } }).webServer

  const offUsageRoute = registerRoute.register({
    kind: 'exact',
    path: '/api/workbench/usage-daily',
    handler: (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ series: ledger.series(14), totals: ledger.totals() }))
    },
  })

  const offActivityRoute = registerRoute.register({
    kind: 'exact',
    path: '/api/workbench/activity',
    handler: (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ events: activity.recent(100) }))
    },
  })

  const offStatusRoute = registerRoute.register({
    kind: 'exact',
    path: '/api/workbench/runtime-status',
    handler: (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(readRuntimeStatus()))
    },
  })

  // Subagent model configuration (GET current + POST to set)
  const offSubagentRoute = registerRoute.register({
    kind: 'exact',
    path: '/api/workbench/subagent-model',
    handler: async (req, res) => {
      res.setHeader('content-type', 'application/json')
      const httpReq = req as {
        method?: string
        on?: (event: string, cb: (chunk?: Buffer) => void) => void
      }

      if (httpReq.method === 'OPTIONS') {
        res.setHeader('access-control-allow-origin', '*')
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
        res.setHeader('access-control-allow-headers', 'content-type')
        res.end('')
        return
      }

      if (httpReq.method === 'POST') {
        try {
          // Read the body from the raw IncomingMessage stream
          const body = await new Promise<string>((resolve) => {
            let data = ''
            httpReq.on?.('data', (chunk?: Buffer) => {
              data += chunk?.toString() ?? ''
            })
            httpReq.on?.('end', () => resolve(data))
          })
          const parsed = JSON.parse(body) as { provider?: string; model?: string; clear?: boolean }
          if (parsed.clear) {
            writeSubagentModel(null)
          } else if (parsed.provider && parsed.model) {
            writeSubagentModel({ provider: parsed.provider, model: parsed.model })
          } else {
            res.end(JSON.stringify({ error: 'provider and model required' }))
            return
          }
          res.end(JSON.stringify({ ok: true, restartNeeded: true }))
        } catch (err) {
          res.end(JSON.stringify({ error: String(err) }))
        }
        return
      }

      // GET: return current config
      res.end(JSON.stringify({ current: readSubagentModel() }))
    },
  })

  ctx.effect(() => {
    return () => {
      offEvents()
      offUsageRoute()
      offActivityRoute()
      offStatusRoute()
      offSubagentRoute()
      ledger.dispose()
    }
  })

  ctx.effect(() => {
    ctx.logger.info(
      '[workbench-panel] loaded: workbench_info tool, usage-daily + activity + runtime-status routes',
    )
    return () => ctx.logger.info('[workbench-panel] unloaded')
  })
}
