import { describe, expect, it, vi } from 'vitest'
import { apply, name } from '../src'

function fakeCtx() {
  const cleanups: Array<() => void> = []
  return {
    cleanups,
    logger: { info: vi.fn() },
    effect: vi.fn((setup: () => () => void) => {
      const cleanup = setup()
      cleanups.push(cleanup)
      return cleanup
    }),
  }
}

describe('workbench-panel plugin', () => {
  it('exports a plugin name', () => {
    expect(name).toBe('workbench-panel')
  })

  it('registers reversible side effects via ctx.effect', () => {
    const ctx = fakeCtx()
    apply(ctx as never)
    expect(ctx.effect).toHaveBeenCalledOnce()
    expect(ctx.logger.info).toHaveBeenCalledWith('[workbench-panel] loaded')
    for (const cleanup of ctx.cleanups) cleanup()
    expect(ctx.logger.info).toHaveBeenCalledWith('[workbench-panel] unloaded')
  })
})
