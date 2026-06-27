# AI Dev Toolkit

> AI 驱动的开发工具集 — Claude Code Skills、MCP Servers、Prompt 模板的统一管理仓库

## 项目概述

本仓库集中管理个人构建的 AI 辅助开发资产，包括 Claude Code 自定义技能（Skills）、MCP Server 配置、以及可复用的 Prompt 模板。所有工具均围绕"用 AI 提升开发效率"这一核心目标设计，覆盖嵌入式开发、竞赛纠错等垂直场景。

## 仓库结构

```
ai-dev-toolkit/
├── skills/                          # Claude Code 自定义技能
│   ├── embedded-dev/                # 嵌入式开发协议（RIPER-5）
│   ├── exam-cram-review/            # 期末突击复习文档生成
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

### exam-cram-review — 期末突击复习文档生成

面向期末考试突击场景的 Claude Code 技能。给定一个课程复习文件夹（含老师划重点/真题/课本 PDF/PPT），自动反向工程生成 Obsidian 可渲染的结构化复习笔记包。

**设计哲学**：真题/作业是锚点，不是验证手段 — 以考过的题反向追溯课本例题和 PPT 框架，只生成"会被考到"的内容。

**核心特性**：

- **反向工程策略**：真题频次分析 → 考点定位 → 课本/PPT 反向追溯 → 锚点驱动生成
- **5 类输出文件/章**：考点清单（★级标注）、例题精讲、公式手卡、真题映射、自测题
- **电路图自动提取**：PyMuPDF 从扫描版/文字版 PDF 提取关键页面为 PNG，嵌入文档
- **Obsidian 原生兼容**：KaTeX 公式 + `[[双链]]` + Callout 折叠答案 + Mermaid 章节关系图
- **输入资料 4 级分类**：P0 考纲层 / P0 题源层 / P1 知识层 / P2 辅助层，按优先级调度上下文
- **工具链容错**：LibreOffice headless + markitdown + PyMuPDF + python-pptx，含完整降级方案
- **本地网页训练器**：`webapp/` 提供仪表盘/知识地图/自测/公式速查四种交互模式，纯静态零后端，做题数据存浏览器 LocalStorage

**依赖**：

| 工具 | 用途 |
|------|------|
| Python 3.8+ | 运行时 |
| PyMuPDF | PDF 页面渲染/图片提取 |
| markitdown | PPT/DOCX → Markdown |
| python-pptx | PPT 内嵌图片提取 |
| LibreOffice | .ppt/.doc 格式转换 |
| Obsidian | 最终阅读器（用户端） |
| 浏览器 | 网页训练器运行环境（可选） |

**已验证案例**：CMOS 模拟集成电路（6 章 × 5 类 = 30 文件 + 总索引 + 24 张电路图 + 76 公式 / 31 自测题导入网页训练器）

📂 [查看详情](skills/exam-cram-review/) · 🌐 [网页训练器](skills/exam-cram-review/webapp/)

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Runtime                   │
├──────────────┬──────────────┬───────────────────────────┤
│   Skills     │  MCP Servers │   Prompt Templates        │
│              │              │                           │
│ embedded-dev │  (待扩展)     │   (待扩展)                │
│ exam-cram    │              │                           │
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

### exam-cram-review

```bash
# 1. 安装依赖
pip install PyMuPDF markitdown python-pptx

# 2. 安装 LibreOffice（Windows）
winget install TheDocumentFoundation.LibreOffice

# 3. 复制技能目录
cp -r skills/exam-cram-review/ ~/.claude/skills/exam-cram-review/

# 4. 验证环境
python -c "import fitz, markitdown, pptx; print('All deps OK')"

# 使用：在 Claude Code 中提及"期末复习"、"突击复习"、"生成复习文档"等关键词自动触发
# 详细环境配置见 skills/exam-cram-review/SETUP.md
```

## License

MIT
