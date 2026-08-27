import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DailyUsageLedger,
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

  it('registers the workbench_info tool and the usage-daily route', () => {
    const ctx = fakeCtx()
    apply(ctx as never)
    expect(ctx.tools.register).toHaveBeenCalledOnce()
    expect((ctx.tools.register.mock.calls[0]?.[0] as { name: string }).name).toBe('workbench_info')
    expect(ctx.webServer.register).toHaveBeenCalledOnce()
    const route = ctx.webServer.register.mock.calls[0]?.[0] as unknown as {
      kind: string
      path: string
    }
    expect(route.kind).toBe('exact')
    expect(route.path).toBe('/api/workbench/usage-daily')
    // The effect must DISPOSE on unload, not immediately during apply.
    expect(ctx.effect.mock.calls[0]?.[0] as unknown).toBeTypeOf('function')
    for (const cleanup of ctx.cleanups) cleanup()
  })
})

describe('usageOf', () => {
  it('reads usage from a usage chunk', () => {
    const usage = { inputTokens: 10, outputTokens: 5 }
    expect(
      usageOf({ type: 'assistant/chunk', turn: 1, step: 1, data: { chunk: { type: 'usage', usage } } }),
    ).toEqual(usage)
  })

  it('reads usage from an assembled assistant message', () => {
    const usage = { inputTokens: 7, outputTokens: 3 }
    expect(usageOf({ type: 'assistant/message', turn: 2, step: 4, data: { usage } })).toEqual(usage)
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
    // streaming usage chunk then finalized message for the same step
    ledger.record('s1', 1, 1, { inputTokens: 120, outputTokens: 15 })
    const today = ledger.series(1)[0]!
    expect(today.i).toBe(120)
    expect(today.o).toBe(15)
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
    expect(series[13]?.date).toBe(todayKey())
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

  it('mounts a persistent floating panel reading real data', () => {
    expect(source).toContain('dshwb-root')
    expect(source).toContain('api.sessions.list({})')
    expect(source).toContain('/api/workbench/usage-daily')
    expect(source).toMatch(/v\.sessionStats/);
    expect(source).toMatch(/v\.tokenUsage/)
  })

  it('declares the same version as the host side', () => {
    expect(source).toMatch(/PLUGIN_VERSION = "0\.5\.0"/)
  })
})
