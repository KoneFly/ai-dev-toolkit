# exam-cram-review

> Claude Code Skill：把散落的课本 PDF、PPT、真题、老师划重点，反向工程为**可交互训练的复习笔记包**。

**设计给谁**：期末考试前 1-4 周、时间紧迫、材料散乱的大学生。

**核心理念**：真题/作业是锚点，不是验证手段。从老师划的重点出发，反向追溯到课本例题，只生成"会被考到"的内容——不通读教材，不写百科全书。

---

## 它能做什么

```
老师划重点.txt + 往年真题.doc + 课本.pdf + PPT
                    ↓ Claude Code 运行 skill
             ai复习/ 文件夹（3 类 MD + data.json）
                    ↓ 启动本地网页训练器
        📊 总览 → 📖 阅读 → ✍️ 练习（含 AI 出题）
```

### 生成产物

每章 3 个精简 Markdown + 1 个结构化 JSON：

| 文件 | 内容 |
|------|------|
| `讲解.md` | 考点清单（星级标注）+ 例题精讲 |
| `题库.md` | 真题映射 + 自测题（折叠答案） |
| `速查.md` | 公式手卡（详细块 + 末尾速查表） |
| `data.json` | 网页训练器的结构化数据源 |

### 配套网页训练器

零构建、零后端的本地静态网页，泛黄笔记纸主题 + 手写体：

| 视图 | 功能 |
|------|------|
| **📊 总览** | 仪表盘（统计卡+章节掌握度+错题清单）+ Cytoscape 知识地图（HTML 索引卡节点） |
| **📖 阅读** | 考点清单 / 题库中心 / 公式速查（Anki 3D 翻转背诵 + 关联高亮），三 tab 切换 |
| **✍️ 练习** | 自测/例题/AI 题三模式 + 内嵌 AI 出题面板（浏览器直连 DeepSeek/Kimi/GLM 等）|

---

## 快速开始

### 1. 安装依赖

```bash
pip install PyMuPDF markitdown python-pptx
```

再装 [LibreOffice](https://www.libreoffice.org/download/)（用于 .ppt/.doc 格式转换）。

### 2. 安装 Skill

```bash
# 克隆到 Claude Code skills 目录
git clone https://github.com/KoneFly/ai-dev-toolkit.git /tmp/ai-dev-toolkit
cp -r /tmp/ai-dev-toolkit/skills/exam-cram-review/ ~/.claude/skills/exam-cram-review/
```

或手动下载 ZIP 解压到 `~/.claude/skills/exam-cram-review/`。

### 3. 准备复习资料

把以下材料放在同一个文件夹内：

```
我的课程/
├── 复习重点.txt          ← 必需：老师划的重点/录音整理
├── 2024试卷.doc          ← 必需：至少 1 份往年真题
├── 课本.pdf              ← 推荐：教材 PDF
├── 第01讲.pptx           ← 推荐：课程 PPT
└── 作业.jpg              ← 可选：作业截图
```

**最低要求**：1 份考纲/重点 + 1 份真题。

### 4. 触发 Skill

在 Claude Code 中输入：

```
帮我用「我的课程」文件夹生成期末突击复习文档，输出到 ai复习/
```

或包含以下任意关键词自动触发：
- 期末复习 / 突击复习 / 考前冲刺 / 生成复习文档

Skill 会自动：
1. 扫描资料 → 按优先级分类
2. 询问输出格式（默认精简 MD + data.json）
3. 提取文本/电路图 → 锚点分析 → 反向追溯
4. 按章生成 `讲解.md + 题库.md + 速查.md + data.json`
5. 提示启动网页训练器

### 5. 启动网页训练器

```bash
cd ~/.claude/skills/exam-cram-review/webapp
python -m http.server 8000
# 浏览器访问 http://localhost:8000
# 点击「选择目录」→ 选择刚生成的 ai复习/
```

### 6. (可选) 配置 AI 出题

网页训练器支持浏览器直连各大 AI API：

1. 进入「✍️ 练习」→ 点「✨ AI 出题」按钮
2. 点击面板中的「配置」链接
3. 选择平台（DeepSeek / 智谱 GLM / Kimi / 通义千问 / 硅基流动 / OpenAI / Ollama）
4. 填入 API Key → 保存

API Key 仅存浏览器 LocalStorage，不经任何中间服务器。

---

## 使用教程

### 场景一：考前 2 天速查公式

1. 启动 webapp → 📖 阅读 → 公式速查 tab
2. 筛选「必背」→ 进入「🃏 卡牌背诵」模式
3. 看公式名 + 条件 → 默写 → 空格翻牌验证 → 1/2 自评
4. 结束后温习错题，循环至全部掌握

### 场景二：考前 5 天系统复习

1. 📊 总览 → 看知识地图，找到「必考通关路线」
2. 按路线顺序进入 📖 阅读 → 考点清单 tab → 逐章展开★★★考点
3. 切到题库中心 → 看真题映射 + 做例题
4. 切到 ✍️ 练习 → 自测模式做题 → 错题自动记录
5. 用 AI 出题扩展练习量 → AI 题直接进入答题流

### 场景三：考前 1 周 + 同学共享

1. 你生成完 `ai复习/` 后，把整个文件夹发给同学
2. 同学解压 → 启动 webapp → 选目录 → 开始练
3. 不需要 Claude Code，不需要 Python（webapp 零依赖）

### 导出 PDF 打印

网页训练器内置打印：点击顶栏「🖨 导出」→ 选择导出模式 → 浏览器打印为 PDF。无需安装 Pandoc/TeX Live。

---

## 技术架构

### Skill 端（Claude Code 运行时）

```
输入材料 → 资料分类（P0考纲/P0题源/P1知识/P2辅助）
        → 批量预处理（LibreOffice/markitdown/PyMuPDF）
        → 锚点构建（真题考点频次 → 反向追溯课本例题）
        → 分章生成（讲解.md / 题库.md / 速查.md）
        → 写 data.json（webapp 结构化数据源）
        → 总索引 + 交付报告
```

关键设计：
- **反向工程**：从真题出发反向追溯，避免全文复述课本（省 70% 上下文）
- **大 PDF 防爆**：按需读取（<10 次 Read，每次 ≤20 页），电路图走文件系统不进 LLM
- **data.json 优先**：结构化数据写入 JSON，webapp 不再靠 MD 正则解析

### Webapp 端（浏览器运行时）

```
webapp/
├── index.html         ← 入口
├── style.css          ← 泛黄笔记纸主题
├── parser.js          ← data.json 优先 + MD 回退解析
├── storage.js         ← LocalStorage 持久化
├── ai-client.js       ← OpenAI 兼容协议客户端（NDJSON 流式）
├── editor.js          ← 编辑器跳转（Obsidian/VS Code/Typora）
└── views/
    ├── overview.js    ← 📊 总览（仪表盘 + 知识地图 协调器）
    ├── read.js        ← 📖 阅读（知识总览 + 公式速查 协调器）
    ├── practice.js    ← ✍️ 练习（自测 + AI 出题 协调器）
    ├── dashboard.js   ← 统计卡 + 掌握度 + 错题
    ├── map.js         ← Cytoscape 知识地图
    ├── knowledge.js   ← 考点/题库阅读器
    ├── quiz.js        ← 自测答题（自测/例题/AI 题三模式）
    ├── formula.js     ← 公式卡片 + Anki 3D 翻转
    └── ai.js          ← AI 出题/讲解核心
```

技术栈：纯 Vanilla JS + CDN（KaTeX / marked / Cytoscape.js / 霞鹜文楷字体）。零构建、零打包、零后端。

### AI 出题支持平台

| 平台 | Base URL | 推荐 |
|------|---------|------|
| DeepSeek | `https://api.deepseek.com/v1` | 最便宜，命题能力强 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | 免费额度大 |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | 长上下文友好 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 中文教材理解好 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | 聚合多家开源模型 |
| OpenAI | `https://api.openai.com/v1` | GPT-4o-mini |
| 自部署 | `http://localhost:11434/v1` | Ollama / vLLM |

---

## 目录结构

```
exam-cram-review/
├── README.md              ← 本文件
├── SKILL.md               ← Skill 入口（触发规则 + 行为规范）
├── QUICKSTART.md           ← 30 秒上手
├── SETUP.md               ← 环境依赖详细配置
├── LICENSE                ← MIT
├── references/
│   ├── workflow.md        ← 完整工作流（6 阶段执行剧本）
│   ├── input-taxonomy.md  ← 输入资料 4 级优先级
│   ├── output-templates.md ← 输出规范 + data.json Schema
│   └── obsidian-conventions.md ← Obsidian 渲染兼容
├── templates/             ← MD 输出模板
├── scripts/               ← 辅助脚本
└── webapp/                ← 本地网页训练器
```

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 没有真题怎么办？ | 用作业题代替，放 jpg/png 即可 |
| PDF 是扫描版能用吗？ | 能，自动提取整页图片 |
| PPT 是旧版 .ppt？ | 自动转 .pptx 再处理 |
| 公式在 MD 中显示错误？ | 用 webapp 查看（data.json 直接渲染，不依赖 MD 格式）|
| webapp 打不开/空白？ | 用 `python -m http.server` 启动，不要直接双击 HTML |
| AI 出题报错？ | 检查 API Key 是否正确，或切换平台 |
| 想分享给同学？ | 把 `webapp/` + `ai复习/` 打包即可，同学无需装任何东西 |

---

## 适用范围

**适合**：
- 期末突击、考前冲刺（时间 ≤ 4 周）
- 有明确考试范围（老师划了重点/有历年真题）
- 理工科公式密集型课程效果最佳

**不适合**：
- 长期系统学习（这不是知识管理工具）
- 没有任何考试参考材料（至少需要 1 份重点 + 1 份真题）
- 开放式研究/论文写作

---

## 许可证

MIT License. Copyright 2026 KoneFly.
