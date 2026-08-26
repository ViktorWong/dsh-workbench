# 设计文档元数据规范

> **适用范围**: 所有设计文档（docs/design/ 下的方案、ADR、测试方案等交付类文档）
> **定位**: 定义统一的 frontmatter 元数据字段，确保可追溯性与自动化可消费性。

---

## 1 必填字段

| 字段名 | 类型 | 必填 | 示例 | 说明 |
|--------|------|:----:|------|------|
| `doc-type` | enum | 是 | `design` / `adr` / `test-plan` | 文档类型 |
| `doc-version` | string | 是 | `v1.0` | 文档版本，格式 `v{major}.{minor}` |
| `issue` | string | 条件 | `#123` | 关联 GitHub issue（有则必填） |
| `maintainer` | string | 是 | `dsh-ta` | 维护智能体/作者 |
| `created_date` | string | 是 | `2026-08-26` | 创建日期 |
| `last_modified` | string | 是 | `2026-08-26` | 最后修订日期 |

## 2 推荐字段

| 字段名 | 类型 | 示例 | 说明 |
|--------|------|------|------|
| `status` | enum | `draft` / `reviewing` / `accepted` | ADR 用 `accepted`/`superseded`；设计文档用 `draft`/`reviewing`/`final` |
| `upstream` | array | `["docs/design/xxx-v1.0.md"]` | 依赖的上游文档（含版本），格式 `{路径}#v{major}.{minor}` |
| `decides` | string | （ADR）一句话决策结论 | 仅 ADR 必填 |

## 3 YAML 示例

```yaml
---
doc-type: adr
doc-version: v1.0
status: accepted
issue: "#12"
maintainer: dsh-ta
created_date: 2026-08-26
last_modified: 2026-08-26
decides: 桌面壳采用 Electron 而非 Tauri
---
```

## 4 使用规则

1. 所有路径字段必须指向实际存在的文件
2. 文档修订时 `doc-version` 的 minor +1；结构性变更（新增/删除章节、推翻决策）major +1
3. **版本累加与旧版保留**：修订产生新文件（版本号递增），禁止覆盖旧版本；评审通过后旧版可移至同目录 `archive/` 子目录，不得删除。报告/会话/草稿类过程文档豁免（可原地修订）
4. `upstream` 引用的文档版本变更后，下游文档需复核并在 `last_modified` 中体现

---

*本文件为共享基础层文件，所有设计文档必须引用本规范填写元数据。*
