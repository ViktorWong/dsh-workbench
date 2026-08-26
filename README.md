# dsh-workbench

> DeepSeek Harness 的开源桌面工作台 —— Electron 桌面壳 + 配套 Cordis 插件集。

**状态**：🏗 v0.1 —— 桌面壳可用（启动/托管 DSH Web 服务、插件预装、托盘、优雅退出）。

## 是什么

[DeepSeek Harness (DSH)](https://deepseek-harness.github.io/deepseek-harness/) 是 DeepSeek 官方开源的 AI Agent 工具，以本地 Node 进程 + Web UI 形态运行。dsh-workbench 为它提供一个开箱即用的桌面端：

- **桌面壳**：Electron 应用，在应用内（ELECTRON_RUN_AS_NODE）托管 DSH 本地服务，无需用户自装 Node；提供托盘、单实例、崩溃自动重启、端口冲突自动协商
- **配套插件**：基于 DSH 官方 Cordis 插件体系的增强插件集，通过专用 profile（`~/.dsh/profiles/dsh-workbench`）预装，不污染用户已有 DSH 环境
- **首个插件功能**：`workbench_info` 诊断工具——agent 可调用的环境快照（版本/平台/运行时），排障时让 agent 跑一下即可收集环境信息

技术决策见 [ADR-001](docs/design/adr/001-desktop-shell-electron-vs-tauri.md)（Electron 选型）与 [ADR-002](docs/design/adr/002-plugin-preinstall-and-distribution.md)（插件预装与分发）。

## 快速开始

```sh
pnpm install
pnpm build                      # 构建桌面壳与插件
pnpm --filter @dsh-workbench/desktop start   # 启动桌面应用
```

应用启动后自动：初始化专用 profile → 预装配套插件（`apps/desktop/resources/plugins/*.tgz`）→ 拉起 DSH 服务（默认 127.0.0.1:3080，被占用自动换端口）→ 窗口加载 DSH Web UI。

冒烟测试（自动启动并退出，产出截图）：

```sh
cd apps/desktop
WORKBENCH_SMOKE=1 WORKBENCH_SMOKE_DELAY_MS=15000 ./node_modules/.bin/electron .
# 预期输出 SMOKE_OK；截图写入 /tmp/workbench-smoke.png
```

## 仓库结构

```
apps/desktop/          # Electron 桌面壳（electron/ 主进程 + src/ 渲染层）
plugins/               # 配套 Cordis 插件（panel-workbench 起步）
docs/design/           # 设计文档与 ADR
.claude/ .zcode/ .opencode/   # AI 协作配置（三 harness 同步）
```

## AI 协作配置

本仓库内置一套多智能体开发配置（6 个 dsh-* 智能体 + 共享基础设施），支持 Claude / ZCode / OpenCode 三种 harness。详见 [docs/agents-design/README.md](docs/agents-design/README.md) 与 [AGENTS.md](AGENTS.md)。

## License

MIT
