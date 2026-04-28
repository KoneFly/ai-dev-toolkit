# AI Dev Toolkit

> AI 驱动的开发工具集 — Claude Code Skills、MCP Servers、Prompt 模板的统一管理仓库

## 项目概述

本仓库集中管理个人构建的 AI 辅助开发资产，包括 Claude Code 自定义技能（Skills）、MCP Server 配置、以及可复用的 Prompt 模板。所有工具均围绕"用 AI 提升开发效率"这一核心目标设计，覆盖嵌入式开发、竞赛纠错等垂直场景。

## 仓库结构

```
ai-dev-toolkit/
├── skills/                          # Claude Code 自定义技能
│   ├── embedded-dev/                # 嵌入式开发协议（RIPER-5）
│   └── lanqiao-fix/                 # 蓝桥杯竞赛自进化纠错系统
├── mcp/                             # MCP Server 配置与工具（待扩展）
├── prompts/                         # 可复用 Prompt 模板（待扩展）
└── README.md
```

## Skills 技能列表

### embedded-dev — RIPER-5 嵌入式芯片开发协议

一套面向嵌入式开发的结构化 AI 技能协议。以 RIPER-5 五阶段推理流程（Research → Innovate → Plan → Execute → Review）为核心，配套多 Agent 分权协作、四文件磁盘记忆系统、自动化 Hooks 与工具降级链，系统性解决 AI 在嵌入式开发中的五大痛点：

| 痛点 | 解决方案 |
|------|---------|
| API 幻觉 | 强制查询离线速查 / Context7 / 官方文档，禁止凭记忆猜测函数签名 |
| 引脚盲猜 | 强制数据手册/网表查询 → 冲突检测 → 硬件资源表生成 |
| 上下文丢失 | 四文件磁盘记忆 + 五问重启测试 + Hooks 自动提醒 |
| 验证纪律缺失 | 验证门铁律 + 反自欺检查表 + 三次失败回退机制 |
| 驱动重复造轮子 | 驱动移植优先原则 + 开源库分类索引 + 搜索优先链路 |

**核心特性**：

- **RIPER-5 五阶段长链推理**：每阶段有严格的允许/禁止边界，防止 AI 跳过调研直接写代码
- **多 Agent 协作**：标准模式（Scout/Builder/Verifier 三角色分权）+ 比赛模式（ARCH/DRV/ALG/QA 四角色并行）
- **四文件磁盘记忆**：项目规划清单、编辑清单、硬件资源表、研究发现，跨会话不丢失上下文
- **Hooks 自动化守护**：写代码前注入硬件约束上下文，写代码后提醒同步更新清单
- **6 类 MCP 工具 + 完整降级矩阵**：grok-search、Context7、gh CLI、Document Skills、Sequential Thinking、Embedded Debugger
- **覆盖平台**：STM32、ESP32、Arduino、RISC-V、NXP、TI MSP430、国产芯片（CH32/GD32/AT32/APM32）

**落地效果**：已在个人 STM32/ESP32 项目与蓝桥杯备赛中使用，API 幻觉导致的编译/运行错误率降低约 70%，驱动开发与调试效率提升约 60%，稳定支持跨会话的长周期嵌入式开发任务。

📂 [查看详情](skills/embedded-dev/)

### lanqiao-fix — 蓝桥杯竞赛自进化纠错系统

面向蓝桥杯嵌入式/算法竞赛的 Claude Code 纠错技能。给定竞赛题文件夹（题目 PDF/PPT、源代码、错误截图），自动分析并修复代码中的 bug。

**核心特性**：

- **双模式自适应**：自动检测 fix-report.md 切换 — 首次走经验模式，二次走深度模式（5 维度排查）
- **经验库驱动**：74 条经验模式按标签智能筛选，高命中率模式优先检查
- **自进化积累**：每次使用后自动学习新模式，形成"深度模式喂养经验模式"的正循环
- **三阶段分析**：经验库筛选 → 核心清单兜底 → 开放分析
- **5 维度深排**：数据流追踪 / 状态机验证 / 边界条件 / 时序逻辑 / 模块交互
- **全格式题目**：支持 PDF/PPT/Word/Markdown/截图，自动分类题目截图与错误截图

**版本演进**：v1.0 静态清单 → v2.0 经验库驱动 → v3.0 双模式自适应（当前）

**数据来源**：15 届国赛实战 + 10 个满分项目 + 10 份修复笔记，共 74 条经验模式

📂 [查看详情](skills/lanqiao-fix/)

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Runtime                   │
├──────────────┬──────────────┬───────────────────────────┤
│   Skills     │  MCP Servers │   Prompt Templates        │
│              │              │                           │
│ embedded-dev │  (待扩展)     │   (待扩展)                │
│ lanqiao-fix  │              │                           │
├──────────────┴──────────────┴───────────────────────────┤
│                    核心能力层                             │
│  ┌────────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │ 长链推理    │ │ 多Agent  │ │ 磁盘记忆 + Hooks 守护  │ │
│  │ (RIPER-5)  │ │ 分权协作  │ │ (四文件 + 五问重启)    │ │
│  └────────────┘ └──────────┘ └────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                    工具集成层                             │
│  Context7 · grok-search · gh CLI · Document Skills      │
│  Sequential Thinking · Embedded Debugger · Serial MCP   │
└─────────────────────────────────────────────────────────┘
```

## 安装与使用

### embedded-dev

将 `skills/embedded-dev/` 目录复制到 Claude Code 的 Skills 目录，或在项目中引用。触发词包括：`嵌入式`、`STM32`、`ESP32`、`固件`、`外设` 等。

### lanqiao-fix

```bash
# 复制技能文件
cp skills/lanqiao-fix/lanqiao-fix.md ~/.claude/commands/

# 复制经验库
cp skills/lanqiao-fix/lanqiao-fix-experience.json ~/.claude/

# 使用
# 在 Claude Code 中执行：/lanqiao-fix <题目文件夹路径>
```

## License

MIT
