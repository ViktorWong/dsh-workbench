---
doc-type: adr
doc-version: v1.0
status: accepted
maintainer: dsh-ta
created_date: 2026-08-26
last_modified: 2026-08-26
decides: 桌面壳采用 Electron（而非 Tauri），以 Utility Process 承载 DSH Node 服务
---

# ADR-001: 桌面壳技术选型 —— Electron vs Tauri

## 1 背景

dsh-workbench 的核心使命是把 DeepSeek Harness（DSH）交付为桌面应用。DSH 的技术形态决定了桌面壳的约束：

- DSH 是 **Node.js 项目**（`@deepseek-ai/dsh`，官方推荐 `npx @deepseek-ai/dsh web` 启动），运行形态是"本地 Node 进程 + Web UI（默认 127.0.0.1:3080）"（🟢 来源：DSH 官方文档 quickstart 与 develop/basic）
- 插件体系是 **Cordis**（TypeScript 模块 `apply(ctx)`），配置按 bundle → profile → home patch → `--patch` 四层叠加（🟢 来源：DSH reference/config-catalog、develop/basic）
- 我们的交付物 = 桌面壳 + 若干 Cordis 插件（插件与壳同仓、同 TypeScript 工具链开发）

因此桌面壳要解决的本质问题是：**以最少摩擦的方式托管一个 Node 服务及其 Web UI，并提供桌面级体验（托盘、通知、自动更新、多平台打包）**。

## 2 决策

**采用 Electron。**

核心架构：

```
Electron App
├── Main Process（窗口/托盘/自动更新/生命周期）
│     └── 以子进程（Utility Process，ELECTRON_RUN_AS_NODE）运行 @deepseek-ai/dsh web
│           └── 监听 127.0.0.1:3080（端口冲突时自动换端口）
├── Preload（contextBridge 暴露受控桌面 API：窗口控制、通知、协议、文件对话框）
└── Renderer（BrowserWindow 加载 http://127.0.0.1:3080）
      └── DSH Web UI + 预装的配套插件 bundle（externals: react、@deepseek-ai/*）
```

配套插件预装方式：首次启动时向 Harness home（`~/.dsh`）的 profile 写入本仓库插件的 tgz/bundle 注册，或通过 `--patch` overlay 指向应用资源内插件（两者择一，在 ADR-002 细化）。

## 3 备选方案与未选原因

### 3.1 Tauri

优点：产物体积小（数 MB vs ~100MB）、内存占用低、Rust 侧安全模型严格。

未选原因：

1. **无自带 Node 运行时**。DSH 是 Node 项目，Tauri 需要 sidecar 捆绑独立 Node 二进制（各平台 × arch 组合的体积和签名负担），或要求用户自装 Node——与"开箱即用的桌面壳"目标冲突。Electron 自带 Node，DSH 服务可在应用内直接运行，**终端用户零 Node 前置要求**（这是决定性因素 🟡 推理：桌面应用受众不限于开发者）
2. **三平台 Web 引擎不一致**（WKWebView / WebView2 / WebKitGTK），WebKitGTK 对现代前端特性兼容性弱；Electron 全平台同一 Chromium 版本，与 DSH Web UI 的兼容风险更低 🟡
3. **工具链断层**：DSH 插件生态全 TypeScript/npm；Tauri 原生层是 Rust，插件作者的桌面集成能力被语言边界截断 🟡
4. 体积劣势对桌面工具场景可接受；启动性能可优化

### 3.2 纯 Web/PWA（不做桌面壳）

放弃：无法提供托盘、全局快捷键、文件关联、自动更新、子进程管理等桌面能力，且这正是不做桌面壳要失去的东西。

## 4 风险与缓解

| 风险 | 等级 | 缓解 |
|------|:----:|------|
| Electron 安装体积 ~100MB+ | 中 | 用 asar 压缩、按平台 dmg/nsis/AppImage 产物；说明页明示 |
| 内存占用高于 Tauri | 中 | 单窗口策略、隐藏时降帧；DSH 服务进程按需重启 |
| dsh 子进程生命周期复杂（崩溃/端口冲突/升级） | 高 | 主进程 Supervisor 模块：健康检查、退避重启、端口探测；专项测试（dsh-qa） |
| DSH 版本升级破坏兼容 | 高 | 锁定 dsh 版本范围 + 启动时版本协商；CI 对 DSH 新版本跑冒烟 |
| 安全（本地服务暴露 127.0.0.1） | 中 | 仅绑定回环地址；Preload 白名单化桌面 API；渲染层无特权 |

## 5 影响范围

- 仓库结构：`apps/desktop`（Electron）+ `plugins/*`（Cordis 插件），pnpm monorepo
- CI：GitHub Actions 三平台矩阵 + electron-builder 产物 + 插件 tgz 发布
- 后续 ADR：ADR-002 插件分发与预装机制；ADR-003 自动更新通道设计

## 6 置信度统计

🟢 ~60% / 🟡 ~40% / 🔴 0%（DSH 行为均有官方文档依据；Tauri 对比项为工程推理，标注 🟡 待评审挑战）
