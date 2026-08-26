# Git 工作流与 CI 集成规则

> **适用范围**: 所有涉及代码提交的智能体
> **定位**: 定义分支策略、提交规范与 CI 集成规则（GitHub 开源协作流程）。

---

## 1 分支策略

| 场景 | 分支命名 | 说明 |
|------|----------|------|
| 功能开发 | `feat/{issue号}-{主题}` | 如 `feat/12-plugin-loader` |
| 缺陷修复 | `fix/{issue号}-{主题}` | |
| 文档 | `docs/{主题}` | 设计文档、README 等 |
| 发布 | `release/v{版本号}` | 版本冻结与 changelog 整理 |

- 主分支 `main` 始终可发布；一切变更经 PR 合并
- 大型设计先在分支上提交设计文档（docs/design/），评审通过后再进入编码

## 2 提交规范

- Commit message 遵循 **Conventional Commits**：`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:` / `build:`
- 每次 commit 聚焦单一目的；关联 issue 用 footer（`Closes #123`）
- 示例：`feat: add dsh process supervisor in main process (#12)`

### 2.1 提交前检查（强制）

- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test` 通过（涉及 UI 时含相关 E2E）
- 编译/测试未通过不得提交，必须先修复

## 3 CI 集成（GitHub Actions）

| 阶段 | 触发 | 自动化动作 |
|------|------|-----------|
| push / PR | 每次推送 | lint + typecheck + test + build 矩阵（macOS/Windows/Linux） |
| PR | 更新 | 代码评审通过后允许合并（分支保护） |
| tag `v*` | 打 tag | electron-builder 多平台打包 + 创建 GitHub Release + 发布插件 tgz |

### 3.1 CI 失败反馈循环

- CI 失败时，将失败信息（编译错误、测试失败、lint 违规）反馈给提交对应的编码智能体触发修复
- **失败升级规则**：连续 3 次 CI 失败则暂停自动修复，升级为人工介入并输出失败分析报告

## 4 代码库集成策略

编码任务开始前的三步法：

| 步骤 | 动作 | 时机 |
|:----:|------|------|
| 1 | 扫描项目结构、代码风格模式、公共组件清单 | 首次接入（一次性） |
| 2 | 从现有同类型模块提取代码风格基准 | 每个编码任务开始前 |
| 3 | 编译 + lint + 依赖冲突检查 | 每次代码生成后 |

### 4.1 增量集成检查清单

- [ ] `pnpm build` 通过
- [ ] 新增 import 无依赖冲突
- [ ] 未重复实现代码库已有的工具函数/公共组件
- [ ] 命名符合代码库现有约定
- [ ] 新增配置项/环境变量有定义与文档

---

*本文件为共享基础层文件，所有代码提交类任务必须引用本文件。*
