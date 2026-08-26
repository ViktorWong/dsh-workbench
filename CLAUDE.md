# CLAUDE.md

> 本文件为 Claude 系 harness 的入口配置。完整协作规范见 [AGENTS.md](./AGENTS.md)——**启动时必须先读取 AGENTS.md**。

## 行为守则（速览）

- 行动前先思考，写代码前先阅读现有文件
- 输出简洁，推理彻底；优先编辑而非重写
- 在宣布完成前测试你的代码；不做奉承式开场/结尾
- 用户指令始终覆盖本文件
- 除非用户另有指定，始终使用简体中文交流

## 智能体配置

- 配置源：`.claude/agents/`（6 个 dsh-* 智能体）+ `.claude/skills/_common/`（共享基础设施）
- 花名册与协作矩阵：`.claude/skills/_common/common-definitions.md`
- 修改配置后必须同步 `.zcode/` 与 `.opencode/` 副本

## 项目一句话

dsh-workbench：DeepSeek Harness 的开源 Electron 桌面壳 + 配套 Cordis 插件集。
