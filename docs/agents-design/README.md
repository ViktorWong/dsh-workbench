# dsh-workbench 智能体体系设计

> 本目录说明 dsh-workbench 仓库的 AI 智能体体系：设计原则、花名册、协作方式与维护规则。

## 1 来源与演进

本体系从一套成熟的企业产研 AI 协作配置（15 agent + 55 skill + 36 个 `_common` 基础设施文件，Claude/ZCode/OpenCode 三 harness 同步）**去业务化移植**而来：

- **保留**：多 harness 同步机制、`_common` 共享基础设施模式（三层结构 L1 角色 / L2 模板 / L3 资料）、子代理 8 项上下文任务单、任务规模识别、评审基础框架（举证义务、评审独立性、缺陷四级）、置信度三色标、会话生命周期管理、输出与元数据规范
- **剥离**：企业文档工作流（PRD/TID/BAD 等编制-评审流水线）、内部知识库与模型网关、业务系统上下文
- **替换**：所有角色职责改写为 dsh-workbench 桌面壳与 Cordis 插件开发语境

## 2 设计原则

1. **从简起步**：开源桌面工具项目先配 6 个角色，随需要扩展；不预设企业级 15+ 角色
2. **单一事实来源（SSOT）**：花名册、协作矩阵、行为守则只在 `common-definitions.md` 维护一份
3. **三层结构**：L1 角色定义（.claude/agents/）→ L2 通用模板（_common/）→ L3 项目资料（docs/）
4. **三 harness 同步**：`.claude/` 为源，`.zcode/`、`.opencode/` 为同步副本，修改后必须同步
5. **版本化**：体系整体版本 1.0.0（语义化），变更经 Git 追溯

## 3 花名册（6 智能体）

| Agent | 角色 | 核心产出 |
|-------|------|---------|
| dsh-tasker | 任务协调 | issue 分诊、任务单、编排决策 |
| dsh-ta | 技术架构 | 架构设计文档、ADR、技术评审 |
| dsh-fed | 前端开发 | 渲染层与插件 Web 端代码 |
| dsh-fsd | 全栈开发 | 主进程/渲染/插件全链路代码、原型 |
| dsh-qa | 测试 | 测试方案、单测/E2E、缺陷报告 |
| dsh-devops | 发布工程 | CI 流水线、打包发布、Release |

协作关系（上游/下游/并行）见 `_common/common-definitions.md` §4。

## 4 维护规则

- 新增/修改智能体：先改 `common-definitions.md` 花名册与协作矩阵，再改定义文件，最后同步 `.zcode/` 与 `.opencode/`
- 新增技能：按 `agent-templates.md` §9 模板，放入 `.claude/skills/skill-{动词}-{对象}/SKILL.md`
- 所有 `_common` 规则修改遵循 SSOT 原则：先定位唯一维护文件，只改一处，其余引用
- 一致性校验：`diff -r .claude/agents .zcode/agents` 等命令验证副本同步

## 5 后续扩展方向（按需）

- 独立 skill 化：代码评审、发布冒烟等高频流程从角色职责中拆出为 skill
- 角色扩展候选：dsh-docs（文档与社区）、dsh-sec（安全审计）——在出现持续需求前不预建
