---
doc-type: adr
doc-version: v1.1
status: accepted
issue: ""
maintainer: dsh-ta
created_date: 2026-08-26
last_modified: 2026-08-26
decides: 配套插件经专用 profile（dsh-workbench）预装分发，不做 --patch 分发；插件以预构建 tgz（后续可上 npm）交付
---

# ADR-002: 配套插件的预装与分发机制

## 1 背景

dsh-workbench 桌面壳内置多个配套 Cordis 插件（工作台、用量面板等），需要回答两个问题：

1. **预装**：桌面壳如何让用户开箱即得这些插件，且不污染用户已有 DSH 环境？
2. **分发**：插件包以什么形态交付到用户机器？

依据 DSH 官方机制（🟢 来源：develop/basic/publish）：

- **bundle（组合包）**：npm 包，`package.json` 声明 `dsh.bundle.patch` 指向 `cordis.patch.yml`
- **profile**：位于 `$DSH_HOME/profiles/<name>`，由 pnpm 管理树外依赖 + `dsh.profile.bundles` 有序组合包列表；**`dsh plugin --profile X add <来源>` 命令自动维护 manifest**（初始化 profile、链接依赖、追加 bundles）
- 配置叠加顺序：各 bundle patch（按列表序）→ profile 自身 `cordis.patch.yml` → home 级 `$DSH_HOME/cordis.patch.yml` → `--patch` overlay；**后层按行胜出，整行替换不深度合并**
- 关键约束：**`--patch` 只贡献配置，不改变 loader 解析模块路径所用的 profile 目录**（🟢 来源：develop/basic）——即 `--patch` 无法分发插件代码

## 2 决策

### 2.1 预装：专用 profile，隔离用户环境

桌面壳启动 dsh 服务时**始终使用专用 profile**：

```
dsh --profile dsh-workbench web
```

- **首次启动 provisioning**：壳从应用资源（`resources/plugins/*.tgz`）执行
  `dsh plugin --profile dsh-workbench add ./<plugin>.tgz` 安装全部配套插件
- **升级**：壳版本更新后检测插件版本差异，重新 add 新版 tgz（同版本跳过）
- **隔离性**：用户的默认 profile 与已装插件完全不受影响；用户仍可在自己 profile 独立使用/卸载我们的插件
- **用户偏好仍生效**：home 级 `cordis.patch.yml` 层高于 bundle 层，用户的机器级偏好（模型配置等）在壳内同样生效 🟢
- **冲突处理**：若 profile 损坏（残留半安装状态），壳提供"重置工作台 profile"动作（删除 `$DSH_HOME/profiles/dsh-workbench` 重建），只影响壳内环境

### 2.2 分发：预构建 tgz，后续可上 npm

- 每个插件在 CI 中 `pnpm pack` 产出**预构建 tgz**（lib/ 已编译），随桌面壳安装包内置 + 附到 GitHub Release
- 预构建原因：git 直装拉源码且不跑 build，需要用户 `allowBuilds` 授权安装期执行脚本——**安全上不可接受**（🟢 来源：publish 页对 allowBuilds 风险的说明）
- 后续可选：发布到 npm（`dsh plugin add <pkg>` 直接装预构建包），为非桌面壳的 DSH 用户提供独立安装渠道

### 2.3 插件包规范（本仓库 plugins/*）

```
plugins/<name>/
├── package.json        # dsh.bundle.patch: ./cordis.patch.yml；files 含 lib 与 patch
├── cordis.patch.yml    # - insert: [{id, name: <包名>}]
└── src/index.ts        # export function apply(ctx)（tsdown 构建到 lib/）
```

- react 与 `@deepseek-ai/*` 一律 external
- patch 行按 id 命名，预留被用户覆盖的空间（默认值贴合用户会保留的配置 🟢）

## 3 备选方案与未选原因

| 方案 | 未选原因 |
|------|---------|
| `--patch` overlay 直接注入插件 | 只贡献配置行，无法分发插件代码（模块解析仍在 profile 目录）；只能作为 profile 安装的补充而非替代 |
| 写用户默认 profile | 污染用户环境；卸载壳后残留；与用户自己安装的同名插件冲突 |
| git 直装（`add github:...`） | 需 allowBuilds 授权安装期执行代码，安全风险且体验差 |
| 每次 `--patch` 指向 app 内置目录 | 模块解析问题同上；且绕过 pnpm 依赖管理 |

## 4 风险与缓解

| 风险 | 等级 | 缓解 |
|------|:----:|------|
| profile provisioning 失败（pnpm 网络依赖） | 高 | tgz 为本地文件安装，理论无网络依赖；验证 pnpm link 本地路径行为；失败时降级：先以纯 dsh-base 启动并提示插件待装 🟡 |
| 用户手动改坏 dsh-workbench profile | 中 | 提供"重置 profile"动作（§2.1） |
| 插件与用户 home patch 覆盖冲突 | 中 | 遵循整行替换语义，默认值保守；文档说明覆盖方法 |
| `dsh plugin` CLI 行为随版本变化 | 中 | 锁定 dsh 版本范围 + provisioning 失败兜底 + CI 冒烟覆盖安装路径 |

## 5 影响范围

- `apps/desktop` 主进程：provisioning 模块（首次启动/升级检测/重置动作）
- `plugins/*`：包结构按 §2.3 规范；CI 增加 pack 步骤
- 后续 ADR-003：自动更新通道与插件版本联动（壳升级是否强制插件升级）

## 6 实施勘误（v1.1，2026-08-26 实测）

首版实施（Electron 冒烟通过，HTTP 200 + 主界面渲染）中确认的三个文档未明示机制：

1. **profile 必须显式组合 `@deepseek-ai/dsh-web-app`**：`dsh plugin add` 首次初始化 profile 时只装 `@deepseek-ai/dsh-base`（无 Web 服务，进程静默等待）；官方 `web` profile 的 bundles 为 `[dsh-base, dsh-web-app]`。内置组合包从 dsh 安装目录解析，无需 pnpm 依赖。→ provisioning 在 add 后向 profile manifest 的 bundles 数组插入 `@deepseek-ai/dsh-web-app`
2. **自定义 profile 用 `dsh --profile <name>` 直启**，不能用 `web` 子命令（`web` 是 `--profile web` 的别名，拒绝父级 `--profile`）；`--host/--port/--no-open` 等 Web 应用参数直接跟在 profile 后转发
3. **直接 spawn dsh bin 需要 `--expose-internals`**：dsh-base 组合的 cordis-plugin-hmr 要求该 node flag；经 shell 包装启动时由包装器保证，Electron-as-Node 直接 spawn 时必须显式传给子进程

## 7 置信度统计

🟢 ~70% / 🟡 ~30% / 🔴 0%（profile/bundle/安装命令均有官方文档依据；provisioning 的失败路径为工程设计推断）
