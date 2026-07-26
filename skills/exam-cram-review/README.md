# exam-cram-review — 期末突击复习 AI Skill

> 从「复习重点 + 课本 + PPT + 真题」反向工程为**可立即使用的复习笔记** + **交互式网页训练器**
>
> 设计哲学：**真题是锚点，不是验证手段** — 以考过的题反向追溯课本，只生成「会被考到」的内容

## 它能做什么

```
你的课程资料                    exam-cram-review                 你得到的
┌──────────────┐              ┌────────────────┐              ┌──────────────────┐
│ 复习重点.txt  │──┐           │                │              │ 结构化复习笔记     │
│ 2024真题.doc  │──┤   触发    │  Claude Code   │   生成       │  · 考点清单(★级)  │
│ 课本.pdf     │──┼──────────▶│  Skill 自动    │──────────▶  │  · 例题精讲       │
│ 第01讲.pptx  │──┤   处理    │  反向工程      │              │  · 公式手卡       │
│ 作业.jpg     │──┘           │                │              │  · 真题映射       │
└──────────────┘              └────────────────┘              │  · 自测题        │
                                                              │  · data.json     │
                                                              └───────┬──────────┘
                                                                      │ 加载
                                                              ┌───────▼──────────┐
                                                              │  网页训练器       │
                                                              │  · 📊 总览+地图   │
                                                              │  · 📖 阅读+公式   │
                                                              │  · ✍️ 练习+AI出题 │
                                                              └──────────────────┘
```

## 核心特性

### Skill 生成端（Claude Code 自动执行）

- **反向工程策略**：真题频次分析 → 考点定位 → 课本/PPT 反向追溯，不通读全书省 token
- **4 级资料分类**：P0 考纲层 / P0 题源层 / P1 知识层 / P2 辅助层，按优先级调度上下文
- **电路图自动提取**：PyMuPDF 从扫描版/文字版 PDF 提取关键电路图为 PNG
- **data.json 结构化输出**：网页端直接读取，不再依赖 MD 标题正则解析
- **精简 MD + 按需规整**：默认省 token，需要 Obsidian/打印时才生成排版版

### 网页训练器（零构建、零后端、纯浏览器）

泛黄笔记纸主题 + 霞鹜文楷手写体，3 个核心视图：

| 视图 | 功能 |
|------|------|
| **📊 总览** | 统计卡片 + 章节掌握度 + 最近错题 + Cytoscape.js 知识地图（HTML 索引卡节点 + 推荐路线） |
| **📖 阅读** | 考点清单 / 题库中心（例题+真题）/ 公式速查（Anki 3D 翻转 + 关联发光），三 tab 切换 |
| **✍️ 练习** | 自测/例题/AI 题三模式 + 内嵌 AI 出题面板 + 错题 AI 讲解 + 键盘快捷键（J/K/Space） |

### AI 出题系统（浏览器直连，零后端）

- 支持 7 大平台：DeepSeek / 智谱 GLM / Kimi / 通义千问 / 硅基流动 / OpenAI / Ollama
- NDJSON 流式协议：边生成边显示，单题失败不影响其他
- N>5 自动拆两批并行，响应速度翻倍
- API Key 仅存浏览器 LocalStorage，不经任何中间服务器

## 快速开始

### 1. 安装依赖

```bash
pip install PyMuPDF markitdown python-pptx
```

再装 [LibreOffice](https://www.libreoffice.org/download/)（用于 .ppt/.doc 转换）。

### 2. 安装 Skill

```bash
cp -r skills/exam-cram-review/ ~/.claude/skills/exam-cram-review/
```

### 3. 触发

在 Claude Code 中说：

> "帮我用 `我的课程` 文件夹生成期末突击复习文档"

包含以下关键词自动触发：`期末复习` / `突击复习` / `考前冲刺` / `生成复习文档`

### 4. 启动网页训练器

```bash
cd ~/.claude/skills/exam-cram-review/webapp
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

### 5.（可选）配置 AI 出题

进入 webapp → 点「✍️ 练习」→ 点「✨ AI 出题」→ 填 API Key 即可。推荐 DeepSeek（最便宜）或智谱 GLM（免费额度大）。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| Skill 生成端 | Claude Code + Python | PyMuPDF / markitdown / python-pptx / LibreOffice |
| 网页训练器 | 纯 Vanilla JS | 零框架、零构建、零打包，CDN 加载所有依赖 |
| 公式渲染 | KaTeX | `$...$` 行内 + `$$...$$` 块级 |
| Markdown 解析 | marked.js | 考点/例题/真题的富文本渲染 |
| 知识地图 | Cytoscape.js | HTML 索引卡节点 + cytoscape-node-html-label 插件 |
| 字体 | 霞鹜文楷 + Caveat | 中文手写体 + 英文手写体（CDN） |
| AI 通信 | fetch + SSE | OpenAI 兼容协议，流式 NDJSON |
| 数据持久化 | LocalStorage | 练习进度/错题/AI 配置/题库 |

## 目录结构

```
exam-cram-review/
├── SKILL.md                  ← Skill 入口（触发规则 + 流程概览）
├── QUICKSTART.md             ← 30 秒快速开始
├── SETUP.md                  ← 完整环境配置
├── project.yaml              ← 项目元信息
├── references/               ← 详细规范文档
│   ├── workflow.md           ← 5+1 阶段完整工作流
│   ├── input-taxonomy.md     ← 输入资料 4 级分类
│   ├── output-templates.md   ← 输出文档模板
│   └── obsidian-conventions.md
├── templates/                ← MD 输出模板 + 子代理 prompt
├── scripts/                  ← 辅助脚本
└── webapp/                   ← 网页训练器（核心）
    ├── index.html            ← 入口
    ├── style.css             ← 笔记纸主题
    ├── app.js                ← 视图调度
    ├── parser.js             ← MD/data.json 解析
    ├── ai-client.js          ← AI API 客户端
    ├── storage.js            ← 数据持久化
    ├── editor.js             ← 编辑器跳转
    └── views/                ← 各视图模块
```

## 已验证案例

CMOS 模拟集成电路课程实测：
- 6 章 × 3 类 MD = 18 文件 + 总索引 + data.json
- 40 考点 / 76 公式 / 31 自测题 / 24 张电路图
- 网页训练器完整加载，AI 出题 + Anki 背诵 + 知识地图全功能可用

## 设计亮点

**为什么不用 React/Vue？** 单 HTML 双击即开是核心卖点。用户（考前突击的学生）不应该被 `npm install` 挡住。

**为什么不用后端代理 AI？** API Key 存浏览器 LocalStorage，请求由浏览器直发。零部署、零服务器、零隐私风险。主流中国 AI 平台（DeepSeek/Kimi/GLM/通义/硅基）都已开放浏览器 CORS。

**为什么用 data.json 而不是纯解析 MD？** MD 正则解析脆弱（LaTeX 公式里的 `$` / `#` 会干扰标题匹配），data.json 是结构化的唯一可靠数据源。MD 保留为人类可读的备份。

## License

MIT

## 作者

[@KoneFly](https://github.com/KoneFly)
