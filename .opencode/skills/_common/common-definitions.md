# 通用定义

> **适用范围**: 所有智能体定义与后续技能定义
> **定位**: 定义全局通用的术语、优先级体系、智能体花名册、协作矩阵、行为守则、子代理上下文传递等基础概念。各智能体定义文件引用本文件而非重复定义。

---

## 1 项目术语表

| 术语 | 定义 |
|------|------|
| DSH | DeepSeek Harness，DeepSeek 官方开源的 AI Agent 工具，本地 Node 进程 + Web UI（默认 127.0.0.1:3080） |
| 桌面壳 (Desktop Shell) | dsh-workbench 的 Electron 应用，负责拉起并托管 DSH Web 服务 |
| Cordis | DSH 的插件框架（`@deepseek-ai/cordis`），插件 = 导出 `apply(ctx)` 的 TypeScript 模块 |
| 配置叠加 | DSH 插件配置的合并顺序：bundle → profile patch → Harness home（`~/.dsh`）patch → `--patch` overlay |
| externals | Web 客户端加载插件 bundle 时不打进包的依赖（react、`@deepseek-ai/*`） |
| Harness home | DSH 的用户级配置目录（`~/.dsh`），存放 profile 与树外插件 |
| ADR | Architecture Decision Record，架构决策记录（`docs/design/adr/`） |

## 2 统一优先级体系

所有 issue、任务、缺陷统一使用 **P0-P3 四级优先级**：

| 优先级 | 定义 | 处理要求 |
|:------:|:----:|:---------|
| **P0** | 核心/致命 | 阻塞性问题，必须当前版本解决，阻塞发布 |
| **P1** | 重要/严重 | 关键功能或质量问题，应当当前版本解决 |
| **P2** | 中等/一般 | 非阻塞问题，可在后续版本优化 |
| **P3** | 低/建议 | 体验优化类，资源允许可实现 |

## 3 智能体花名册

当前智能体体系共 **6 个智能体**（`dsh-` 前缀）：

| 分类 | Agent ID | 职责 |
|------|----------|------|
| 协调 | dsh-tasker | 任务协调专家 — issue 分诊、任务分解、多 agent 编排、进度管理 |
| 架构 | dsh-ta | 技术架构师 — 桌面壳总体架构、Electron 进程模型、插件体系集成、ADR |
| 开发 | dsh-fed | 前端开发专家 — React 渲染层 UI、插件 Web 端 |
| 开发 | dsh-fsd | 全栈开发专家 — Electron 主进程 + 渲染层 + 插件全链路、快速原型 |
| 测试 | dsh-qa | 测试工程专家 — Vitest/Playwright、Electron 专项、插件回归 |
| 发布 | dsh-devops | 发布工程专家 — GitHub Actions CI、electron-builder 打包、自动更新、Release |

> 花名册为本表单一事实来源（SSOT）。新增/删除智能体时先修订本表，再同步各定义文件与 `.zcode`/`.opencode` 副本。

## 4 智能体协作矩阵

| 智能体 | 上游协作方 | 下游协作方 | 并行协作者 |
|--------|-----------|-----------|----------|
| dsh-tasker | （用户需求 / GitHub issue 入口） | 全部其他智能体 | 无（串行分派） |
| dsh-ta | dsh-tasker | dsh-fed, dsh-fsd, dsh-qa | — |
| dsh-fed | dsh-tasker, dsh-ta | dsh-qa | dsh-fsd |
| dsh-fsd | dsh-tasker, dsh-ta | dsh-qa | dsh-fed |
| dsh-qa | dsh-tasker, dsh-fed, dsh-fsd | dsh-devops | — |
| dsh-devops | dsh-tasker, dsh-qa | （发布与用户反馈） | — |

### 4.1 角色 × 阶段矩阵

| 阶段 | 主导 Agent | 协作 Agent |
|------|------------|------------|
| issue 分诊与拆解 | dsh-tasker | — |
| 方案设计（docs/design/） | dsh-ta | dsh-fsd（可行性）、dsh-qa（可测试性） |
| 编码实现 | dsh-fed / dsh-fsd | dsh-ta（设计答疑） |
| 代码评审 | dsh-fed 与 dsh-fsd 交叉评审 | dsh-ta（架构相关时） |
| 测试 | dsh-qa | dsh-fed / dsh-fsd（缺陷修复） |
| 打包发布 | dsh-devops | dsh-qa（发布冒烟） |

## 5 通用行为守则

> 各智能体定义文件中仅保留角色特有的行为守则（2-3 条），并在守则顶部声明：`通用守则: 参见 _common/common-definitions.md §5`。

1. 行动前先思考，写代码前先阅读现有文件
2. 输出要简洁，但推理要彻底
3. 优先编辑而不是重写整个文件
4. 不要重复阅读已读过的文件
5. 在宣布完成前测试你的代码
6. 不要有奉承的开场白或结束语
7. 保持解决方案简单直接
8. 用户指令始终覆盖此文件
9. 除非用户另有指定，否则始终使用简体中文交流

## 6 子代理上下文传递清单

向子代理委派任务时，必须传递以下 8 项上下文，禁止让子代理在缺少上下文的情况下"猜测"工作内容：

1. **业务背景**：dsh-workbench 项目上下文与本次任务的场景
2. **任务目标**：具体目标和预期产出
3. **技术约束**：技术栈、架构约束、平台限制
4. **依赖关系**：依赖的上游任务、文档或数据
5. **验收标准**：明确的完成条件（如 lint/test/build 通过）
6. **参考资料**：相关文档路径、设计文档、issue 链接
7. **当前进度**：整体进度、已完成工作、当前阶段
8. **相关决策**：已做出的关键决策及其依据

缺少任一项时，主代理必须主动提供或说明缺失原因。任务单模板见 `_common/agent-templates.md`。

## 7 共享基础设施文件索引

`_common/` 目录文件清单（10 个）：

| 文件 | 定位 |
|------|------|
| `common-definitions.md` | 通用定义（本文件，SSOT） |
| `agent-templates.md` | 智能体定义模板、子代理任务单、会话记录、任务规模识别、评审报告模板 |
| `metadata-schema.md` | 设计文档元数据规范 |
| `loading-strategy.md` | L0/L1/L2 分层加载策略 |
| `output-conventions.md` | 输出路径与命名规范 |
| `code-review-checklist.md` | 代码评审检查清单（含 AI 幻觉专项） |
| `git-workflow-rules.md` | 分支、提交与 CI 集成规则 |
| `session-lifecycle-management.md` | 会话生命周期管理（复用/新建策略、上下文释放） |
| `review-foundation.md` | 通用评审基础框架（原则、缺陷等级、独立性） |
| `confidence-marking.md` | 置信度三色标使用规范 |

## 8 单一来源治理原则

- 每条规则/清单/字段定义**只能在 1 个文件**中维护，其他文件通过引用使用
- 修改任一规则时，必须先定位"唯一维护文件"，仅在该文件中修改
- 发现重复定义时必须删除并改为引用
- 新规则引入前必须明确其"唯一维护文件"

## 9 版本管理规范

- 智能体与 `_common` 文件采用语义化版本号 `MAJOR.MINOR.PATCH`（当前体系版本 **1.0.0**）
- MAJOR：架构性变更（新增/删除智能体、流程重构）；MINOR：功能增强；PATCH：缺陷修复与清理
- 每次修订后同步更新 frontmatter 的 `version` 字段；变更历史通过 Git 追溯，不写入正文
- `.claude/` 为配置源，`.zcode/` 与 `.opencode/` 为同步副本，三者内容必须一致；修改后必须同步

---

*本文件为共享基础层文件，各智能体引用本文件定义通用概念，不重复定义。*
