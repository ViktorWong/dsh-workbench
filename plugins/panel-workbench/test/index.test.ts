import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { apply, inject, name } from '../src'

function fakeCtx() {
  const cleanups: Array<() => void> = []
  return {
    cleanups,
    logger: { info: vi.fn() },
    tools: { register: vi.fn() },
    effect: vi.fn((setup: () => () => void) => {
      const cleanup = setup()
      cleanups.push(cleanup)
      return cleanup
    }),
  }
}

describe('workbench-panel plugin (host side)', () => {
  it('exports a plugin name and injects the tools registry', () => {
    expect(name).toBe('workbench-panel')
    expect(inject).toContain('tools')
  })

  it('registers the workbench_info tool', () => {
    const ctx = fakeCtx()
    apply(ctx as never)
    expect(ctx.tools.register).toHaveBeenCalledOnce()
    const tool = ctx.tools.register.mock.calls[0]?.[0] as { name: string }
    expect(tool.name).toBe('workbench_info')
  })

  it('workbench_info execute returns a diagnostic snapshot', async () => {
    const ctx = fakeCtx()
    apply(ctx as never)
    const tool = ctx.tools.register.mock.calls[0]?.[0] as {
      execute: (args: Record<string, never>) => Promise<string>
    }
    const out = await tool.execute({})
    expect(out).toContain('dsh-workbench panel: v')
    expect(out).toContain(`node: ${process.version}`)
    expect(out).toContain(`platform: ${process.platform}`)
  })

  it('registers reversible side effects via ctx.effect', () => {
    const ctx = fakeCtx()
    apply(ctx as never)
    expect(ctx.effect).toHaveBeenCalledOnce()
    expect(ctx.logger.info).toHaveBeenCalledWith(
      '[workbench-panel] loaded, tool workbench_info registered',
    )
    for (const cleanup of ctx.cleanups) cleanup()
    expect(ctx.logger.info).toHaveBeenCalledWith('[workbench-panel] unloaded')
  })
})

describe('workbench-panel plugin (web client bundle)', () => {
  const source = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')

  it('registers a factory via the __ModuleLoader__ handshake', () => {
    expect(source).toContain('window.__ModuleLoader__.load({')
    expect(source).toContain('"@dsh-workbench/panel-workbench"')
  })

  it('exports a web plugin (apply + inject) and hooks a settings slot', () => {
    expect(source).toContain('exports.apply = apply')
    expect(source).toContain('exports.inject = inject')
    expect(source).toContain('"settings.section"')
    // Client inject declares service keys; ctx.slots requires the "slots" key.
    expect(source).toMatch(/var inject = \["slots"\]/)
  })

  it('declares the same version as the host side', () => {
    expect(source).toMatch(/PLUGIN_VERSION = "0\.3\.0"/)
  })
})
