import type { Context } from '@deepseek-ai/cordis'

export const name = 'workbench-panel'

export function apply(ctx: Context) {
  // All side effects must be registered via ctx.effect() so that unloading
  // and hot-reload stay reversible (see plugins/README.md hard rules).
  ctx.effect(() => {
    ctx.logger.info('[workbench-panel] loaded')
    return () => ctx.logger.info('[workbench-panel] unloaded')
  })
}
