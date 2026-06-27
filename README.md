# AI Dev Toolkit

> AI 驱动的开发工具集 — Claude Code Skills、MCP Servers、Prompt 模板的统一管理仓库

## 项目概述

本仓库是 [@KoneFly](https://github.com/KoneFly) 的 AI 辅助开发资产汇总，目的是**把分散在不同来源的优秀 Claude Code 技能集中到一处**，方便自用与按需引用。仓库内容分两类：

- 🌟 **原创**：自己设计与实现的技能
- 🔗 **收录/转载**：来自其他作者的优秀开源技能，保留其原始作者署名与协议；本仓库不主张其著作权

所有工具均围绕"用 AI 提升开发效率"这一核心目标，覆盖嵌入式开发、竞赛纠错、期末突击复习等垂直场景。

## 仓库结构

```
ai-dev-toolkit/
├── skills/                          # Claude Code 自定义技能
│   ├── exam-cram-review/            # 🌟 原创：期末突击复习文档生成 + 网页训练器
│   ├── embedded-dev/                # 🔗 收录：RIPER-5 嵌入式开发协议
│   └── lanqiao-fix/                 # 🔗 收录：蓝桥杯竞赛自进化纠错系统
├── mcp/                             # MCP Server 配置与工具（待扩展）
├── prompts/                         # 可复用 Prompt 模板（待扩展）
└── README.md
```

## Skills 技能列表

### 🌟 exam-cram-review — 期末突击复习文档生成（原创）

> **作者**：[@KoneFly](https://github.com/KoneFly) · **协议**：MIT · **状态**：本仓库为唯一源

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

---

### 🔗 embedded-dev — RIPER-5 嵌入式开发协议（收录）

> **原作者**：[@DunCanYounG-1](https://github.com/DunCanYounG-1) · **原仓库**：[DunCanYounG-1/embedded-dev](https://github.com/DunCanYounG-1/embedded-dev)（已更名为 [auto-embedded](https://github.com/DunCanYounG-1/auto-embedded)）
> **底层协议**：RIPER-5 由 [@robotlovehuman](https://github.com/robotlovehuman) 原创（[Cursor 论坛原帖](https://forum.cursor.com/t/i-created-an-amazing-mode-called-riper-5-mode-fixes-claude-3-7-drastically/65516)）
> **状态**：本仓库为镜像收录，请优先使用上游最新版本

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
- **覆盖平台**：STM32、ESP32、Arduino、RISC-V、NXP、TI MSP430、国产芯片（CH32/GD32/AT32/APM32）

**落地效果（KoneFly 个人使用反馈）**：在 STM32/ESP32 项目与蓝桥杯备赛中使用，API 幻觉导致的编译/运行错误率显著下降，驱动开发与调试效率提升明显，稳定支持跨会话长任务。

📂 [查看本仓库版本](skills/embedded-dev/) · 🌐 [上游最新版本（推荐）](https://github.com/DunCanYounG-1/auto-embedded)

---

### 🔗 lanqiao-fix — 蓝桥杯竞赛自进化纠错系统（收录）

> **原作者**：[@562862](https://github.com/562862) · **原仓库**：[562862/my-skill](https://github.com/562862/my-skill)
> **状态**：本仓库为镜像收录，请优先使用上游最新版本

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

📂 [查看本仓库版本](skills/lanqiao-fix/) · 🌐 [上游原仓库（推荐）](https://github.com/562862/my-skill)

---

## 安装与使用

### exam-cram-review（原创）

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
# 详细配置见 skills/exam-cram-review/SETUP.md
```

### embedded-dev（收录）

将 `skills/embedded-dev/` 目录复制到 Claude Code 的 Skills 目录，或在项目中引用。触发词包括：`嵌入式`、`STM32`、`ESP32`、`固件`、`外设` 等。

> ⚠️ **推荐直接使用上游版本**：原作者持续维护中，本仓库版本可能滞后。前往 [DunCanYounG-1/auto-embedded](https://github.com/DunCanYounG-1/auto-embedded) 获取最新协议、知识库与比赛模式。

### lanqiao-fix（收录）

```bash
# 复制技能文件
cp skills/lanqiao-fix/lanqiao-fix.md ~/.claude/commands/

# 复制经验库
cp skills/lanqiao-fix/lanqiao-fix-experience.json ~/.claude/

# 使用：在 Claude Code 中执行 /lanqiao-fix <题目文件夹路径>
```

> ⚠️ **推荐直接使用上游版本**：经验库由原作者持续从国赛实战中迭代。前往 [562862/my-skill](https://github.com/562862/my-skill) 获取最新版本。

---

## 致谢与归属（Credits）

本仓库的诞生离不开开源社区的优秀工作，特此致谢：

| 技能 | 原作者 | 原仓库 | 角色 |
|------|--------|--------|------|
| **embedded-dev** | [@DunCanYounG-1](https://github.com/DunCanYounG-1) | [auto-embedded](https://github.com/DunCanYounG-1/auto-embedded) | 嵌入式适配 + 知识库构建 |
| **RIPER-5 协议** | [@robotlovehuman](https://github.com/robotlovehuman) | [Cursor 论坛原帖](https://forum.cursor.com/t/i-created-an-amazing-mode-called-riper-5-mode-fixes-claude-3-7-drastically/65516) | 协议原创设计 |
| **lanqiao-fix** | [@562862](https://github.com/562862) | [my-skill](https://github.com/562862/my-skill) | 经验库与双模式架构 |

**说明**：以上技能本仓库**仅作镜像收录**，便于本人本地引用与跨设备同步。所有著作权归原作者所有，使用时请遵循各项目原协议；如需最新版本或参与贡献，**请直接前往上游仓库**。

如本仓库收录有不当之处（例如协议冲突、署名缺失、原作者要求下架），请通过 [Issues](https://github.com/KoneFly/ai-dev-toolkit/issues) 联系我，会立即处理。

---

## License

- 🌟 **原创内容**（exam-cram-review、本 README、仓库组织结构）：[MIT License](LICENSE)
- 🔗 **收录内容**（embedded-dev、lanqiao-fix）：遵循各自上游仓库的协议
