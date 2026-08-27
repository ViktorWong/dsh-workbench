# dsh-workbench

> The open-source desktop workbench for DeepSeek Harness — an Electron shell hosting the local DSH service, with companion Cordis plugins.

**English** | [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-8257ff.svg)](LICENSE)
![macOS](https://img.shields.io/badge/platform-macOS%20%28ARM64%20%7C%20x64%29-333) ![Windows](https://img.shields.io/badge/platform-Windows%20x64-333) ![Linux](https://img.shields.io/badge/platform-Linux%20x86__64-333)

[Website](https://viktorwong.github.io/dsh-workbench/) · [Downloads](https://github.com/ViktorWong/dsh-workbench/releases)

## What is this

[DeepSeek Harness (DSH)](https://deepseek-harness.github.io/deepseek-harness/) is DeepSeek's open-source AI agent tool that runs as a local Node process with a web UI. dsh-workbench turns it into a desktop app:

- **Desktop shell** — an Electron app hosting the DSH service in-process (`ELECTRON_RUN_AS_NODE`), no Node.js install required; tray, single instance, crash backoff restart, port-conflict negotiation, graceful shutdown.
- **Companion plugins** — Cordis-plugin enhancements shipped with the app: a `workbench_info` diagnostics tool and a Workbench settings section with real session stats and token usage (whole-log projections).
- **Isolated profile** — everything runs in a dedicated profile (`~/.dsh/profiles/dsh-workbench`); your existing DSH setup is untouched.

Technical decisions are recorded as ADRs in [docs/design/](docs/design/) — notably [ADR-001](docs/design/adr/001-desktop-shell-electron-vs-tauri.md) (why Electron) and [ADR-002](docs/design/adr/002-plugin-preinstall-and-distribution.md) (plugin preinstall via a dedicated profile).

## Install

Grab an installer from the [releases page](https://github.com/ViktorWong/dsh-workbench/releases): dmg (Apple Silicon / Intel), NSIS exe (Windows), AppImage / deb (Linux).

> **macOS first launch**: builds are ad-hoc signed until a Developer ID certificate is configured. If Gatekeeper blocks the app, right-click it → **Open**, or run `xattr -cr /Applications/dsh-workbench.app`. On Windows, choose **More info → Run anyway** on the SmartScreen prompt.

## Develop

```sh
pnpm install
pnpm build                                    # build shell + plugins
pnpm --filter @dsh-workbench/desktop start    # launch the desktop app

# smoke run (auto-starts and quits, captures a screenshot)
cd apps/desktop && WORKBENCH_SMOKE=1 WORKBENCH_SMOKE_DELAY_MS=10000 pnpm exec electron .
```

Repository layout: `apps/desktop` (Electron shell), `plugins/` (Cordis plugins), `docs/design/` (ADRs), `.claude|.zcode|.opencode` (a 6-agent AI collaboration config, see [docs/agents-design](docs/agents-design/README.md)).

## Status

Early preview, tracking `@deepseek-ai/dsh@0.1.1-rc.2`. The DSH runtime ships as a standalone, asar-external tree inside the app; version bumps are locked and smoke-tested.

## License

MIT
