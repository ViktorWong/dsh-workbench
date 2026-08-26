# 配套插件（plugins/）

每个子目录是一个 Cordis 组合包（bundle），遵循 ADR-002 的分发规范：

```
plugins/<name>/
├── package.json        # 声明 dsh.bundle.patch；files 含 lib/ 与 cordis.patch.yml
├── cordis.patch.yml    # - insert: [{ id: <插件id>, name: <包名> }]
└── src/index.ts        # export function apply(ctx)；构建到 lib/
```

## 硬性约束

- react 与 `@deepseek-ai/*` 一律 **external**（宿主 Web 客户端已提供）
- 副作用经 `ctx.effect()` 注册，保证卸载/热重载可逆
- 服务依赖用 `inject` 显式声明
- 不修改、不覆盖官方插件行；纯增量（slot/overlay 注入）

## 构建与打包

```sh
pnpm --filter <plugin-pkg> build   # tsdown 转译 src/ -> lib/（不做类型检查，自包含）
pnpm --filter <plugin-pkg> pack    # 产出 tgz（CI 附到 Release 并打进桌面壳资源）
```

## 当前插件清单

| 包 | 说明 | 状态 |
|----|------|------|
| `@dsh-workbench/panel-workbench` | `workbench_info` 诊断工具（agent 可调用的环境快照）；工作台 UI 开发中 | ✅ v0.2 可用 |

## 产物验证

```sh
pnpm --filter @dsh-workbench/panel-workbench test    # 单测（注册/执行/可逆性）
pnpm --filter @dsh-workbench/panel-workbench smoke   # 构建产物冒烟（lib/index.mjs 真实加载）
```
