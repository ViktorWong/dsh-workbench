import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { PLUGIN_VERSION } from './version'

export const name = 'workbench-panel'

export const inject = ['tools']

const bootedAt = Date.now()

/**
 * Diagnostics tool: when a user reports an issue, the agent can call this to
 * capture a snapshot of the workbench environment (runtime, versions, uptime)
 * without shell access. Output schema is plain strings so it renders in any
 * client.
 */
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

export function apply(ctx: Context) {
  ctx.tools.register(workbenchInfo)

  // All side effects must stay reversible (unload / hot-reload).
  ctx.effect(() => {
    ctx.logger.info('[workbench-panel] loaded, tool workbench_info registered')
    return () => ctx.logger.info('[workbench-panel] unloaded')
  })
}
