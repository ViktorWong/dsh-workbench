---
doc-type: adr
doc-version: v1.0
status: accepted
maintainer: dsh-devops
created_date: 2026-08-27
last_modified: 2026-08-27
decides: 更新通道用 GitHub Releases；macOS 走 Developer ID + 公证；Windows 先无签名发布、后续上 OV 证书；证书经 CI secrets 注入，未签名可正常出包
---

# ADR-003: 代码签名、公证与自动更新通道

## 1 背景

dsh-workbench 面向三平台分发桌面安装包。不签名的后果：

- **macOS**：Gatekeeper 拦截，用户需"右键 → 打开"或 `xattr -cr` 绕过；且 macOS 26 起趋严
- **Windows**：SmartScreen 警告（"未知发布者"），下载即吓退普通用户
- **Linux**：AppImage/deb 无强制签名要求，影响最小

自动更新（electron-updater）依赖可信的发布通道与稳定的产物元数据（latest.yml 等）。

## 2 决策

### 2.1 更新通道：GitHub Releases

- electron-builder `publish.provider: github`（已配置）
- tag `v*` 触发发布流水线，产物 + latest.yml 附到 Release
- 通道划分：stable = 正式 tag；beta = `v*-beta.*` tag（复用同一 provider，客户端按版本号区分）

### 2.2 macOS：Developer ID + 公证（目标态）

| 步骤 | 操作 | 产出 |
|------|------|------|
| 1 | 加入 Apple Developer Program（$99/年） | 开发者账号 |
| 2 | certificates 签发 "Developer ID Application" 证书（Keychain 或 .p12 导出） | `MAC_CSC_LINK`（.p12 base64）+ `MAC_CSC_KEY_PASSWORD` |
| 3 | App 专用密码（appleid.apple.com）用于公证 | `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` |
| 4 | CI 传入上述 secrets 并开启 `--config.mac.notarize=true --config.mac.hardenedRuntime=true` | 签名 + 公证的 dmg/zip |

### 2.3 Windows：先无签名，后上 OV 证书

| 方案 | 成本 | 效果 |
|------|------|------|
| 无签名（当前） | 0 | SmartScreen 警告，README 引导 |
| **OV 证书（推荐下一步）** | Certum Open Source ~€26-70/年（最便宜的合法选择）；SSL.com/Sectigo $100-300/年 | 消除"未知发布者"，SmartScreen 信誉随下载量积累 |
| EV 证书 | $300+/年，硬件 token | SmartScreen 即时信誉 |

启用时：`WIN_CSC_LINK`（.pfx base64）+ `WIN_CSC_KEY_PASSWORD` 注入 CI 即可，配置无需改。

### 2.4 Linux：不签名

AppImage/deb 直接发布；后续如建 APT/YUM 仓库再引入 GPG 签名。

### 2.5 未签名降级（当前态，必须文档化）

- macOS：README 下载节明示"右键 → 打开"或 `xattr -cr /Applications/dsh-workbench.app`
- Windows：SmartScreen "仍要运行" 引导
- Release 说明中标注 UNsigned 产物
- 证书就绪后同一流水线零改动出签名包（secrets 驱动）

## 3 备选方案与未选原因

| 方案 | 未选原因 |
|------|---------|
| Mac App Store | 沙箱模型与拉起本地 Node 子进程/PTY 的核心形态冲突 |
| 自建更新服务器 | 运维成本高，GitHub Releases 对开源项目零成本且 electron-updater 原生支持 |
| 一开始就强制签名 | 证书采购未落地前阻塞发布节奏；env 门控允许渐进启用 |

## 4 CI secrets 契约（证书就绪后填入即启用）

| Secret | 平台 | 用途 |
|--------|------|------|
| `GH_TOKEN` | 全部 | 发布 Release（必填） |
| `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD` | macOS | Developer ID 签名 |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | macOS | 公证 |
| `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` | Windows | 代码签名 |

## 5 风险与缓解

| 风险 | 等级 | 缓解 |
|------|:----:|------|
| 无证书期间用户被安全警告劝退 | 中 | 文档引导 + 尽快落 OV/Developer ID |
| 公证失败阻塞发布 | 中 | CI 中签名/公证仅在有 secrets 时开启；失败不静默 |
| rc 版 dsh 与签名运行时的兼容 | 中 | 发布前跑三平台打包冒烟（后续补 CI 冒烟 job） |

## 6 置信度统计

🟢 ~70% / 🟡 ~30% / 🔴 0%（electron-builder/electron-updater 机制为官方文档实证；证书价格为调研值 🟡，采购前需复核）
