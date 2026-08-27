---
doc-type: design
doc-version: v1.0
status: draft
maintainer: dsh-ta
created_date: 2026-08-27
last_modified: 2026-08-27
issue: ""
---

# 需求分析：会话控制台与工作台增强

> 基于对 DSH 全部 API 面（Sessions/Workspaces/Subagents/Events/Projections 共 42 个包）、
> 参考项目 dsh-worktable、以及 AI 桌面工作台用户画像的系统分析。

## 目录

- [1 用户画像与核心痛点](#1-用户画像与核心痛点)
- [2 功能方案](#2-功能方案)
- [3 技术可行性论证](#3-技术可行性论证)
- [4 明确排除](#4-明确排除)

---

## 1 用户画像与核心痛点

### 1.1 核心用户：用 DSH 做日常开发的工程师

同时跟进多个项目/任务，每个一个 DSH 会话。

| 痛点 | 现状 | 期望 |
|------|------|------|
| 一次只能看一个会话 | DSH 原生 UI 单会话视图，切换靠侧栏文字列表 | 所有会话状态一屏可见 |
| fork 关系不可视 | fork 出的分支对话在侧栏是平铺列表 | 看到"从哪个对话分出来的"血缘树 |
| subagent 活动隐身 | subagent 会话和普通会话混在一起 | 区分显示 + 挂到父会话下 |
| 不知道 agent 在干什么 | 需要切到具体会话才能看到工具调用 | 全局活动时间线，一眼看到谁在忙 |

### 1.2 次级用户：重度 agent 用户

让 agent 跑长任务、多轮迭代、批量操作。

| 痛点 | 现状 | 期望 |
|------|------|------|
| 审批请求容易被忽略 | 只在具体会话内弹出 | 全局提示：哪个会话在等你审批 |
| token 消耗不透明 | 只有一个总数 | 按会话/按天/按模型分组明细 |
| 不知道 agent 改了什么文件 | 需要切到会话看 diff | 活动时间线中直接看到文件操作 |

---

## 2 功能方案

### P0: 会话控制台（Session Console）

> 悬浮面板展开后不再是纯统计卡片，而是**可操作的全宽工作台视图**。

#### 2.1.1 会话卡片网格

每个会话一张卡片，展示：
- **标题**（projections.title，无标题时显示 "新会话"）
- **状态徽章**：🟢 运行中 / ⚪ 空闲 / 🔴 等待审批 / 🟡 进行中（有 pending）
- **workspace**：所属工作区名（cwd 或 workspace.title）
- **数据**：轮次 · tokens · 最后活跃时间
- **快捷操作**：点击卡片 → 跳转到该会话（`sessions.select()`）

#### 2.1.2 Fork 血缘可视化

利用 `SessionSummary.parentSessionId` 构建树形关系：

```
[原始对话] ──fork──▶ [v2: 重构方案] ──fork──▶ [v3: 性能优化]
       └──fork──▶ [备选方案 B]
       └──subagent──▶ [子任务：搜索]（origin: 'subagent'）
```

- SVG 渲染：节点 = 圆角矩形卡片（缩小版），边 = 贝塞尔曲线
- subagent 节点更小、用不同色（橙色边框）
- 点击节点跳转该会话
- 数据来源：`sessions.list()` 已返回全部 `parentSessionId` / `origin`

#### 2.1.3 工作区分组

- 按 workspace 分组展示（`workspaces.list()` → WorkspaceView[]）
- 每个 workspace 标题 + 会话数 + 活跃数
- 无 workspace 的会话归入"未分组"

### P1: 活动时间线（Activity Timeline）

> Agent 在做什么，一眼看到。作为控制台的一个 tab。

#### 2.2.1 事件流

按时间倒序展示最近 N 条（默认 100）：

| 事件类型 | 显示 |
|----------|------|
| `tool/call` → `tool/result` | 🔧 工具名 · 耗时 · ✅/❌ |
| 审批请求 | ⚠️ "会话 X 等待审批：Bash 命令" |
| 会话状态翻转 | ▶️ 会话开始运行 / ⏸️ 空闲 |
| 文件操作 | 📝 文件路径（读写） |

- 每条事件：时间 · 会话标题（色标）· 事件描述 · 耗时
- 可按会话过滤

#### 2.2.2 实现方式

宿主侧新增 `/api/workbench/activity` 路由：
- 内存环形缓冲（最近 200 条）
- 监听 `session/event`，提取 `tool/call`、`tool/result`、审批类事件
- 客户端 10s 轮询拉取

### P2: 成本明细

> 按模型/按会话的 token 分组明细

- 在控制台的统计 tab 中：
  - 按 provider 分组的柱状图
  - Top 5 会话的 token 消耗排名
  - 按模型的输入/输出/缓存分解

数据来源：`sessions.list()` 每行的 `projections.tokenUsage` + `session.models()` 获取 provider。

### P3: 快捷操作

- 新建会话（选择 workspace）
- Fork 当前会话
- 一键重启 runtime（升级后）

---

## 3 技术可行性论证

### 3.1 数据可用性矩阵

| 数据 | API | 已验证 |
|------|-----|--------|
| 会话列表（含 fork/subagent 元数据） | `api.sessions.list({})` | ✅ 当前面板已在用 |
| 会话标题/统计/token 投影 | `SessionSummary.projections` | ✅ 当前面板已在用 |
| 工作区列表 | `api.workspaces.list({})` | ✅ 类型已确认 |
| 实时事件流 | 宿主 `ctx.on('session/event')` | ✅ 用量台账已在用 |
| 工具调用详情 | `ToolEventView` 类型已定义 | 🟡 需确认投影字段 |
| 跳转到指定会话 | `sessions.select()` / `sessions.open()` | ✅ sidebar 已在用 |
| Subagent 列表 | `api.subagents.list()` | ✅ 类型已确认 |

### 3.2 不需要新的 DSH 扩展点

全部功能在现有 `panel-workbench` 插件体系内实现：
- Web 侧：扩展 client.js（vanilla DOM，无新增依赖）
- 宿主侧：扩展 index.ts（新增一个 activity 路由）

### 3.3 性能考量

- 会话列表 60s 刷新（已有）
- 活动时间线 10s 轮询（轻量：<10KB/次）
- Fork 树最多渲染 50 节点（超出折叠为 "…还有 N 个"）

---

## 4 明确排除

| 排除项 | 原因 |
|--------|------|
| 自建对话渲染 | 复用 DSH 原生 conversation UI（成熟且持续迭代） |
| 终端模拟器 | DSH 已有 terminal 工具（PTY），桌面壳无优势 |
| 文件浏览器 | 系统 Finder / IDE 更好；agent 文件变更走活动时间线 |
| 浏览器面板 | 系统浏览器更好；壳内嵌浏览器引入安全面 |
| 聊天输入框 | DSH 原生 UI 已有；重复建设无价值 |

---

## 6 置信度统计

🟢 ~80% / 🟡 ~20% / 🔴 0%（数据面全部来自已验证的 API 类型定义；工具事件投影字段需实测确认 🟡）
