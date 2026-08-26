# AGENTS.md — dsh-workbench AI 协作配置

> 行为守则与工作规范的权威来源。`.claude/` 为配置源，`.zcode/` 与 `.opencode/` 为同步副本。

## 行为守则

- 行动前先思考，写代码前先阅读现有文件
- 输出要简洁，但推理要彻底
- 优先编辑而不是重写整个文件
- 不要重复阅读已读过的文件
- 在宣布完成前测试你的代码
- 不要有奉承的开场白或结束语
- 保持解决方案简单直接
- 用户指令始终覆盖此文件
- 除非用户另有指定，始终使用简体中文交流

## 项目定位

dsh-workbench 是 **DeepSeek Harness（DSH）的开源桌面工作台**：

- 基于 **Electron** 的桌面壳，拉起并托管 DSH 本地 Web 服务（Node 子进程，默认 127.0.0.1:3080）
- 内置多个配套 **Cordis 插件**（DSH 官方插件体系，插件 = 导出 `apply(ctx)` 的 TypeScript 模块）
- DSH 插件配置四层叠加：bundle → profile patch → Harness home（`~/.dsh`）patch → `--patch` overlay
- Web 客户端加载插件 bundle 时，react 与 `@deepseek-ai/*` 为 external

## 目录结构

```
apps/desktop/          # Electron 桌面壳（主进程/渲染进程/预加载）
plugins/               # 配套 Cordis 插件（每个插件一个包）
docs/
  ├── design/          # 设计文档与 ADR（命名见 _common/output-conventions.md）
  └── agents-design/   # 智能体体系设计说明
.claude/               # AI 配置源
  ├── agents/          # 6 个智能体定义（dsh-ta/fed/fsd/qa/devops/tasker）
  └── skills/_common/  # 共享基础设施（10 个通用文件）
.zcode/ .opencode/     # 多 harness 同步副本（内容与 .claude 一致）
.sessions/             # 会话记录（gitignore）
```

## 技术栈

TypeScript · Electron · React · Vite · Cordis（@deepseek-ai/cordis）· Vitest · Playwright · pnpm monorepo · GitHub Actions · electron-builder

## 智能体体系

| 分类 | Agent ID | 职责 |
|------|----------|------|
| 协调 | dsh-tasker | issue 分诊、任务分解、多 agent 编排 |
| 架构 | dsh-ta | 桌面壳架构、Electron 进程模型、插件体系集成、ADR |
| 开发 | dsh-fed | 渲染层 UI、插件 Web 端 |
| 开发 | dsh-fsd | 主进程+渲染层+插件全链路、快速原型 |
| 测试 | dsh-qa | Vitest/Playwright、Electron 专项、插件回归 |
| 发布 | dsh-devops | CI、多平台打包、自动更新、Release |

花名册与协作矩阵的单一事实来源：`.claude/skills/_common/common-definitions.md`。

## 工作规范

### 任务管理
- 任务通过 `todolist` 管理（pending / in_progress / completed）
- 任务规模识别与分解原则见 `_common/agent-templates.md` §7；预计跨 3+ 模块或涉及多专业领域时必须拆分

### 开发流程（开源社区式）
GitHub issue → 轻量设计（docs/design/，复杂度中以上）→ `feat/*` 分支 → PR + 交叉评审 → CI（lint/typecheck/test/build）→ 合并 → release

### 代码与提交
- 遵循现有代码风格；新增代码考虑可测试性
- 提交前 `pnpm lint && pnpm typecheck && pnpm test` 必须通过
- Conventional Commits；每次提交聚焦单一目的；禁止提交敏感信息

### 评审
- 代码评审按 `_common/code-review-checklist.md`；评审原则与缺陷分级见 `_common/review-foundation.md`
- 评审独立性：产出者不终审自己的产出

### 会话与记忆
- 会话记录：`.sessions/dsh-{角色}/{YYYY-MM-DD}/{task}.md`
- 会话复用/新建策略见 `_common/session-lifecycle-management.md`

### 文档
- 设计文档与 ADR 放 `docs/design/`，元数据与命名见 `_common/metadata-schema.md` 与 `_common/output-conventions.md`
- AI 拟定的事实性内容按 `_common/confidence-marking.md` 标注置信度（🟢🟡🔴）

## 语言

文档、评审报告使用简体中文；代码与注释视上下文使用中文或英文。对外（README/CHANGELOG/commit）以英文为主、中文为辅。
