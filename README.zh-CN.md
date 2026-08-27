# dsh-workbench

> DeepSeek Harness 的开源桌面工作台 —— Electron 桌面壳托管 DSH 本地服务，配套 Cordis 插件生态。

[English](README.md) | **简体中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-8257ff.svg)](LICENSE)
![macOS](https://img.shields.io/badge/platform-macOS%20%28ARM64%20%7C%20x64%29-333) ![Windows](https://img.shields.io/badge/platform-Windows%20x64-333) ![Linux](https://img.shields.io/badge/platform-Linux%20x86__64-333)

[官网](https://viktorwong.github.io/dsh-workbench/) · [下载](https://github.com/ViktorWong/dsh-workbench/releases)

## 这是什么

[DeepSeek Harness (DSH)](https://deepseek-harness.github.io/deepseek-harness/) 是 DeepSeek 官方开源的 AI Agent 工具，以「本地 Node 进程 + Web UI」形态运行。dsh-workbench 把它变成一个桌面应用：

- **桌面壳** —— Electron 应用在应用内（`ELECTRON_RUN_AS_NODE`）托管 DSH 服务，用户无需安装 Node；提供托盘、单实例、崩溃指数退避重启、端口冲突自动协商、优雅退出。
- **配套插件** —— 随应用分发的 Cordis 插件增强：`workbench_info` 诊断工具，以及基于全日志投影的会话统计与 token 用量面板（设置页 Workbench 分区）。
- **环境隔离** —— 一切运行在专用 Profile（`~/.dsh/profiles/dsh-workbench`）内，不触碰你已有的 DSH 配置。

技术决策以 ADR 形式沉淀在 [docs/design/](docs/design/)：[ADR-001](docs/design/adr/001-desktop-shell-electron-vs-tauri.md)（为什么选 Electron）、[ADR-002](docs/design/adr/002-plugin-preinstall-and-distribution.md)（专用 Profile 的插件预装与分发）。

## 安装

从 [Releases](https://github.com/ViktorWong/dsh-workbench/releases) 下载对应平台安装包：dmg（Apple Silicon / Intel）、exe 安装器（Windows）、AppImage / deb（Linux）。

> **macOS 首次打开**：在配置正式的 Developer ID 签名公证之前，发布包为 ad-hoc 签名。若被 Gatekeeper 拦截，请**右键点击应用 → 「打开」**，或执行 `xattr -cr /Applications/dsh-workbench.app`。**Windows** 遇到 SmartScreen 提示时选择「更多信息 → 仍要运行」。

## 开发

```sh
pnpm install
pnpm build                                    # 构建桌面壳与插件
pnpm --filter @dsh-workbench/desktop start    # 启动桌面应用

# 冒烟运行（自动启动并退出，落盘截图）
cd apps/desktop && WORKBENCH_SMOKE=1 WORKBENCH_SMOKE_DELAY_MS=10000 pnpm exec electron .
```

仓库结构：`apps/desktop`（Electron 桌面壳）、`plugins/`（Cordis 插件）、`docs/design/`（设计文档与 ADR）、`.claude|.zcode|.opencode`（6 智能体 AI 协作配置，见 [docs/agents-design](docs/agents-design/README.md)）。

## 状态

早期预览，跟随 `@deepseek-ai/dsh@0.1.1-rc.2`。DSH 运行时以独立、asar 之外的文件树随包分发；版本锁定并有冒烟测试覆盖。

## License

MIT
