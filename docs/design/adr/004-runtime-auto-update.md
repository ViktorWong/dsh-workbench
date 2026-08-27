---
doc-type: adr
doc-version: v1.0
status: accepted
maintainer: dsh-ta
created_date: 2026-08-27
last_modified: 2026-08-27
decides: DSH 运行时支持检测官方新版本并自动升级：用户目录 runtime + 自带 pnpm + staging 校验后原子切换，保留一级回滚
---

# ADR-004: DSH 运行时自动升级

## 1 背景

dsh-workbench 把 `@deepseek-ai/dsh` 全家以独立 runtime 树随包分发（ADR-002 §6.8），版本在发布时锁定。DSH 处于 rc 阶段、迭代很快：官方发新版后，用户要么等我们发版，要么无法跟进。目标：**应用能感知官方升级并安全地自动跟进**，不需要等 workbench 发版。

约束：

- macOS 上修改 .app 包内文件会破坏签名（ad-hoc 同样），运行时**不能原地升级捆绑副本**
- 用户机器不假设装有 node/npm/pnpm
- rc 版本可能破坏兼容（ADR-002 记录过 5 个版本敏感点），升级必须可校验、可回滚

## 2 决策

### 2.1 运行时双副本：捆绑模板 + 用户目录工作副本

- 捆绑副本（`Resources/runtime`）只读、随应用分发、永不修改——签名的完整性由它保证
- 首次启动把捆绑副本复制到 `app.getPath('userData')/runtime`，此后 supervisor 的 dsh 从**用户副本**解析；升级只作用于用户副本
- 「重置运行时」= 删除用户副本（下次启动重新从捆绑模板复制）

### 2.2 升级工具自包含：runtime 内置 pnpm

- `prepare-runtime` 在 runtime 的依赖中加入 `pnpm`（纯 Node 包，无构建脚本）
- 升级 = 以 ELECTRON_RUN_AS_NODE 运行 `node_modules/pnpm/bin/pnpm.cjs install --prod --ignore-workspace @deepseek-ai/dsh@<version>`，在 runtime 目录内完成——用户机器零外部工具要求

### 2.3 检测与策略

- 检测源：npm registry dist-tags（`registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags`），启动后 10s 检查一次、此后每 24h 一次；离线静默失败
- **自动升级门**：目标版本与当前版本 **同 major** 才自动执行；跨 major 只记录状态等人工确认（DSH rc 全在 0.x，同 major 门在 0.x 内宽松放行 patch/minor/rc）
- 状态机写入 `~/.dsh/workbench/runtime-status.json`：`idle / checking / updated / skipped-major / error`，由宿主插件经 `/api/workbench/runtime-status` 透出给面板

### 2.4 灰度与回滚

```
userData/runtime (当前) ──复制──▶ userData/runtime-next (staging)
                                     │ pnpm install dsh@new
                                     │ dsh --version 校验（失败即弃）
                                     ▼ 原子换名
userData/runtime-backup ◀──runtime   runtime-next ──▶ userData/runtime
```

- 校验失败或安装失败：删除 staging，当前运行时不动，状态记 error
- 切换成功后旧版本保留为 `runtime-backup`（一级回滚）；下次启动若新运行时 boot 失败，可手动/将来自动回退
- 运行中的 dsh 服务不打断：升级在后台完成后，**下次启动生效**（v1 简化；热切换留给后续）

## 3 备选方案与未选原因

| 方案 | 未选原因 |
|------|---------|
| 只靠 workbench 应用更新带新 runtime | 用户跟进延迟一个发版周期；rc 阶段太慢 |
| 原地改包内 Resources | 破坏 ad-hoc 签名，macOS 会拒绝启动应用 |
| 下载官方 tgz 手工解包替换 | 绕过依赖解析，dsh 全家的依赖树无法正确物化 |
| 检测到即热重启 dsh | 中断用户会话；先积累升级稳定性数据，后续再做 |

## 4 风险与缓解

| 风险 | 等级 | 缓解 |
|------|:----:|------|
| rc 新版破坏 profile/boot 兼容 | 高 | staging `--version` 校验 + 一级 backup + 同 major 门；后续在 CI 加真实 boot 冒烟白名单 |
| dist-tag 指向损坏发布 | 中 | 校验失败自动放弃并保留旧版；状态可观测 |
| 用户目录磁盘占用（runtime ~300MB×3） | 中 | 只保留当前 + backup 两份；重置动作清空 |
| 首次启动复制耗时 | 低 | ~秒级（本地 cp）；进度写状态文件 |

## 5 影响范围

- `apps/desktop/scripts/prepare-runtime.mjs`（+pnpm 依赖）
- `apps/desktop/electron/runtime-manager.ts`（新）
- `apps/desktop/electron/main.ts`（ensureRuntime + 后台检查）
- `plugins/panel-workbench`（v0.6：runtime-status 路由 + 面板显示）

## 6 置信度统计

🟢 ~75% / 🟡 ~25% / 🔴 0%（dist-tags 与 pnpm-as-library 为公开机制；boot 兼容风险为工程判断，靠校验+回滚兜底）
