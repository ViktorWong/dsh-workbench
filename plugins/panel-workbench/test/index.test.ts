import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActivityRing,
  DailyUsageLedger,
  activityOf,
  todayKey,
  usageOf,
  apply,
  inject,
  name,
} from '../src'

function fakeCtx() {
  const cleanups: Array<() => void> = []
  return {
    cleanups,
    logger: { info: vi.fn() },
    tools: { register: vi.fn((_t: unknown) => {}) },
    webServer: { register: vi.fn((_r: unknown) => () => {}) },
    on: vi.fn(() => () => {}),
    effect: vi.fn((setup: () => () => void) => {
      const cleanup = setup()
      cleanups.push(cleanup)
      return cleanup
    }),
  }
}

const tmpDirs: string[] = []
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function newLedger(): DailyUsageLedger {
  const dir = mkdtempSync(path.join(tmpdir(), 'dshwb-'))
  tmpDirs.push(dir)
  return new DailyUsageLedger(path.join(dir, 'usage.json'))
}

describe('workbench-panel plugin (host side)', () => {
  it('exports a plugin name and injects tools + webServer', () => {
    expect(name).toBe('workbench-panel')
    expect(inject).toEqual(['tools', 'webServer'])
  })

  it('registers workbench_info tool and all API routes', () => {
    const ctx = fakeCtx()
    apply(ctx as never)
    expect(ctx.tools.register).toHaveBeenCalledOnce()
    expect((ctx.tools.register.mock.calls[0]?.[0] as { name: string }).name).toBe('workbench_info')
    expect(ctx.webServer.register).toHaveBeenCalledTimes(4)
    const paths = ctx.webServer.register.mock.calls.map(
      (call) => (call[0] as unknown as { path: string }).path,
    )
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/workbench/usage-daily',
        '/api/workbench/activity',
        '/api/workbench/runtime-status',
        '/api/workbench/subagent-model',
      ]),
    )
    expect(ctx.effect.mock.calls[0]?.[0] as unknown).toBeTypeOf('function')
    for (const cleanup of ctx.cleanups) cleanup()
  })
})

describe('usageOf', () => {
  it('reads usage from a usage chunk', () => {
    const usage = { inputTokens: 10, outputTokens: 5 }
    expect(usageOf({ type: 'assistant/chunk', turn: 1, step: 1, data: { chunk: { type: 'usage', usage } } })).toEqual(usage)
  })
  it('reads usage from an assembled assistant message', () => {
    expect(usageOf({ type: 'assistant/message', turn: 2, step: 4, data: { usage: { inputTokens: 7, outputTokens: 3 } } })).toEqual({ inputTokens: 7, outputTokens: 3 })
  })
  it('returns undefined for other events', () => {
    expect(usageOf({ type: 'turn/start', turn: 1 })).toBeUndefined()
  })
})

describe('DailyUsageLedger', () => {
  it('buckets usage into days and sums buckets', () => {
    const ledger = newLedger()
    ledger.record('s1', 1, 1, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 10 })
    ledger.record('s1', 1, 2, { inputTokens: 30, outputTokens: 20 })
    const today = ledger.series(1)[0]!
    expect(today.i).toBe(130)
    expect(today.o).toBe(70)
    expect(today.cr).toBe(10)
  })
  it('replaces same session/turn/step samples instead of double counting', () => {
    const ledger = newLedger()
    ledger.record('s1', 1, 1, { inputTokens: 100, outputTokens: 10 })
    ledger.record('s1', 1, 1, { inputTokens: 120, outputTokens: 15 })
    expect(ledger.series(1)[0]!.i).toBe(120)
    expect(ledger.series(1)[0]!.o).toBe(15)
  })
  it('does not collide across sessions with same turn/step', () => {
    const ledger = newLedger()
    ledger.record('s1', 1, 1, { inputTokens: 10, outputTokens: 1 })
    ledger.record('s2', 1, 1, { inputTokens: 20, outputTokens: 2 })
    expect(ledger.series(1)[0]!.i).toBe(30)
  })
  it('gap-fills the series with zero days', () => {
    const ledger = newLedger()
    const series = ledger.series(14)
    expect(series).toHaveLength(14)
    expect(series[13]!.date).toBe(todayKey())
    expect(series.every((d) => d.i === 0 && d.o === 0)).toBe(true)
  })
  it('persists across instances and survives reload', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dshwb-'))
    tmpDirs.push(dir)
    const file = path.join(dir, 'usage.json')
    const a = new DailyUsageLedger(file)
    a.record('s1', 1, 1, { inputTokens: 42, outputTokens: 4 })
    a.flush()
    const b = new DailyUsageLedger(file)
    expect(b.series(1)[0]!.i).toBe(42)
  })
})

describe('ActivityRing + activityOf', () => {
  it('extracts tool call events', () => {
    const ev = activityOf('s1', { type: 'tool/call', turn: 1, data: { tool: 'bash' } })
    expect(ev).toMatchObject({ kind: 'tool', label: 'bash', sessionKey: 's1' })
  })
  it('extracts tool result events with timing', () => {
    const ev = activityOf('s1', { type: 'tool/result', turn: 1, data: { tool: 'read', ms: 150, ok: true } })
    expect(ev).toMatchObject({ kind: 'tool', label: 'read', ms: 150, ok: true })
  })
  it('extracts approval requests', () => {
    const ev = activityOf('s1', { type: 'approval/request', data: { action: 'bash' } })
    expect(ev).toMatchObject({ kind: 'approval', label: 'bash' })
  })
  it('returns null for non-activity events', () => {
    expect(activityOf('s1', { type: 'turn/start', turn: 1 })).toBeNull()
  })
  it('ring buffer returns newest first and caps at max', () => {
    const ring = new ActivityRing(5)
    for (let i = 0; i < 10; i++) {
      ring.push({ ts: i, sessionKey: 's', kind: 'tool', label: 't' + i })
    }
    const recent = ring.recent(100)
    expect(recent).toHaveLength(5)
    expect(recent[0]!.ts).toBe(9)
  })
})

const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')

describe('workbench-panel plugin (web client bundle)', () => {
  it('registers a factory via the __ModuleLoader__ handshake', () => {
    expect(source).toContain('window.__ModuleLoader__.load({')
    expect(source).toContain('"@dsh-workbench/panel-workbench"')
  })
  it('exports a web plugin with connection inject', () => {
    expect(source).toContain('exports.apply = apply')
    expect(source).toContain('exports.inject = inject')
    expect(source).toMatch(/var inject = \["connection"\]/)
  })
  it('renders session cards with workspace grouping and fork tags', () => {
    expect(source).toContain('dshwb-scard')
    expect(source).toContain('dshwb-wsgroup')
    expect(source).toContain('parentSessionId')
  })
  it('renders an activity timeline reading from the host route', () => {
    expect(source).toContain('dshwb-timeline')
    expect(source).toContain('/api/workbench/activity')
  })
  it('reads real data through the connection RPC face', () => {
    expect(source).toContain('api.sessions.list({})')
    expect(source).toContain('api.workspace.list({})')
    expect(source).toContain('/api/workbench/usage-daily')
  })
  it('supports tab switching between sessions, activity, and stats', () => {
    expect(source).toContain('setTab("sessions")')
    expect(source).toContain('setTab("activity")')
    expect(source).toContain('setTab("stats")')
  })
  it('uses a self-contained palette (no host theme vars)', () => {
    expect(source).not.toMatch(/dsw-alias/)
    expect(source).not.toMatch(/background-clip:\s*text/)
  })
  it('declares the same version as the host side', () => {
    expect(source).toMatch(/PLUGIN_VERSION = "1\.2\.2"/)
  })
})
