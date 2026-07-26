---
name: exam-cram-review
description: "Use this skill when the user is preparing for a final exam under tight time pressure (1-4 weeks) and provides a folder containing course materials such as textbook PDF, lecture PPT/PPTX, past exams (.doc/.docx), instructor's review notes (.txt/.md), or homework problem images. Triggers include phrases like '期末复习', '突击复习', 'final exam prep', '生成复习文档', '考前冲刺', or any request asking to consolidate scattered course materials into a structured review document set. The skill reverse-engineers exam targets: it treats past exams and homework as anchors, traces them back to textbook examples and PPT frameworks, then produces Obsidian-renderable markdown files (key-points / examples / formula cards / exam mapping / self-test) per chapter. Do NOT use this skill for long-horizon learning, daily study planning, or open-ended research — it is optimized for 'pass the exam' scenarios with a known, bounded scope."
license: MIT
---

# 期末突击复习文档生成 Skill

> 把"复习重点 + 课本 + PPT + 作业 + 真题"五类原始材料反向工程为可立即使用的 Obsidian 复习笔记。
> 设计哲学：**真题/作业是锚点，不是验证手段**。

## Quick Reference

| 步骤 | 命令/动作 | 关键产物 |
|------|----------|---------|
| 1. 扫描资料 | Glob `*.pdf` `*.ppt*` `*.doc*` `*.txt` `*.md` | 资料清单+分类 |
| 2. 提取文本 | `soffice --convert-to pptx`+`python -m markitdown` | `_extracted/*.md` |
| 3. 提取电路图 | PyMuPDF pixmap / python-pptx image.blob | `_figures/*.png` |
| 4. 锚点分析 | 读真题/作业 → 提取所有题型 | 考点频次表 |
| 5. 反向追溯 | 真题考点 → 课本例题 + PPT页 | 章节-考点-例题映射 |
| 6. 生成文档 | 按章写 3 类 MD + data.json + 总索引 | `ai复习/*.md + data.json` |

完整流程见 [references/workflow.md](references/workflow.md)。

---

## 何时触发

- 用户提供一个**已经划定范围**的复习文件夹（≠ 通用学习辅助）
- 时间紧迫（"周三考"、"还有两周"、"突击"等措辞）
- 含至少 2 类材料：必有"考点提示"（老师录音/重点.txt/划重点）+ 至少一份历史真题

如果用户只提供课本想"系统学习"，**不要用这个 skill**——它假设范围已知，主动做范围裁剪。

---

## 输入资料分类

每份资料按 4 个优先级分类，决定如何使用（详见 [references/input-taxonomy.md](references/input-taxonomy.md)）：

| 优先级 | 资料类型 | 作用 | 处理动作 |
|--------|---------|------|---------|
| P0 考纲层 | 老师录音整理/划重点 txt | 决定输出的章节顺序和考点星级 | 整篇通读，做考点清单 |
| P0 题源层 | 往年真题 + 作业 | 输出物的核心，必须 100% 覆盖 | 提取所有题，按章节归类 |
| P1 知识层 | 课本 PDF + PPT | 被动调用：只提取真题/作业涉及的内容 | 不全文复述，按需引用 |
| P2 辅助层 | 大纲图/思维导图 | 验证章节结构完整性 | 对照检查 |

> ⚠️ 反模式：把 P1 知识层当成主资料"系统化整理"——会浪费 70% 上下文且偏离突击场景。

---

## 输出文档结构

**以 webapp 网页端为核心阅读/训练界面**，MD 文件为辅助备份（默认精简，省 token）。

每章生成 3 个精简 MD + 根目录 1 个 data.json：

```
{用户指定输出目录}/
├── 00_总索引.md              ← 含 Mermaid 章节关系图 + 突击建议
├── data.json                 ← webapp 主数据源（结构化，parser 优先读取）
├── 01_第N章_{章节名}/
│   ├── 讲解.md               ← 考点清单（★级标注）+ 例题精讲（合并）
│   ├── 题库.md               ← 真题映射 + 自测题（折叠答案）
│   └── 速查.md               ← 公式手卡（H2 详细块 + 末尾速查表）
└── _extracted/               ← 中间产物（PPT/Word 提取结果），可删
```

**data.json** 是网页端的**唯一可靠数据源**。结构化字段（keypoints/examples/formulas/quizQuestions/examMapping/deps）全部写入 JSON，webapp parser 读 JSON 直接填充，**不再依赖 MD 的标题正则**。

MD 文件**默认精简**（不追求 Obsidian 排版），仅当用户明确说"要看 MD/要打印/要用 Obsidian"时才生成规整版。详见 [references/output-templates.md](references/output-templates.md)。

---

## Obsidian 渲染兼容

详见 [references/obsidian-conventions.md](references/obsidian-conventions.md)。核心约束：

- 公式：`$...$` 内联，`$$...$$` 块级（KaTeX 默认开启）
- 双链：`[[文件名#章节]]` 跨文档跳转
- 图表：优先 Mermaid（章节流程/状态机），复杂关联用 Obsidian Canvas
- 答案折叠：`> [!faq]- 答案` 用 Callout 折叠，避免自测时偷看
- 不使用 HTML，不使用 `<details>` 标签（Obsidian 不解析）

---

## 关键工具链

| 任务 | 工具 | 备注 |
|------|------|------|
| 老式 .ppt → .pptx | `soffice --headless --convert-to pptx` | LibreOffice 必备 |
| .pptx → md | `python -m markitdown deck.pptx` | 来自 [[pptx]] skill |
| .doc → utf8 txt | `soffice --convert-to txt:Text` + iconv GB18030 | 中文.doc 编码常需修正 |
| 大 PDF 分批读取 | Read 工具 pages 参数，每次 ≤20 页 | 注意书本页与 PDF 页的偏移 |
| **电路图提取（扫描版PDF）** | `PyMuPDF page.get_pixmap(dpi=200, clip=rect)` | 整页或裁剪区域→PNG |
| **电路图提取（文字版PDF）** | `PyMuPDF page.get_images()` 提取嵌入位图 | 矢量图仍需 pixmap |
| **PPT 图片提取** | `python-pptx` 遍历 shapes → 保存 image.blob | EMF/PNG 均可 |
| 思维导图 | Mermaid（简单）/ Obsidian Canvas（中等）/ Project Graph（复杂） | 默认 Mermaid |

---

## 调用示例

用户输入：
> 帮我用模集文件夹生成复习文档，输出到 ai复习/。Obsidian 阅读。

执行：
1. 扫描文件夹 → 识别复习重点.txt（P0考纲）、2 份真题（P0题源）、8 份PPT+1份PDF（P1知识）
2. **确认输出格式**：询问用户选择生成哪些输出（见下方"输出格式选择"）
3. 批量提取 PPT/Word 文本到 `_extracted/`
4. 读复习重点 → 列出 6 大考点章节
5. 读真题 → 每题打标签归入章节
6. 按章节生成 5 类文件，最后写 00_总索引.md
7. （若选 PDF）执行 `scripts/md2pdf.sh` 把 MD 转为 PDF
8. （若选 webapp）提示用户启动 webapp 训练器

完整执行剧本见 [references/workflow.md](references/workflow.md)。

---

## 输出格式选择

资料盘点完成后，**必须询问用户**想要哪种输出格式：

| 选项 | 产出 | 适合场景 |
|------|------|---------|
| A. 仅精简 MD | `ai复习/*.md`（3 文件/章 + data.json） | 快速生成，以 webapp 为主 |
| B. 精简 MD + 规整 MD | 同上 + 排版规整版（Obsidian/打印友好） | 需要独立阅读 MD |
| **C. 默认推荐** | 精简 MD + data.json + 提示启动 webapp | 推荐：webapp 为核心 |

**注意**：
- webapp 内置「🖨 导出」按钮可直接浏览器打印 PDF，**不再强依赖 Pandoc/TeX Live**
- 选 B 时在精简 MD 基础上补充排版（双链、Obsidian Callout、详细注释），约多消耗 30% token

---

## 配套交互式训练器

`webapp/` 目录提供本地静态网页训练器（**泛黄笔记纸主题 + 手写体**），3 个核心视图：

| 视图 | 功能 |
|------|------|
| 📊 总览 | 仪表盘（统计卡+章节掌握度+错题清单）+ 知识地图（Cytoscape HTML 索引卡节点） |
| 📖 阅读 | 考点清单 / 题库中心（例题+真题）/ 公式速查（Anki 3D 翻转+关联高亮），三 tab 切换 |
| ✍️ 练习 | 自测/例题/AI 题三模式 + 内嵌 AI 出题面板 + 错题 AI 讲解 + 键盘快捷键 |

### 核心定位

**webapp 是主要阅读/训练界面**，MD 文件是结构化备份。data.json 是两者的桥梁。

| 场景 | 用什么 |
|------|--------|
| 交互训练 + 错题追踪 + 进度可视化 + AI 出题 | webapp（核心） |
| 沉浸阅读 + 加自己笔记 | MD 编辑器（辅助，需要时再生成规整版）|
| 打印纸质版 | webapp 内「🖨 导出」按钮 |

详见 [webapp/README.md](webapp/README.md)。

**何时推荐用户启动 webapp**：生成完所有文件后，在最终汇报中**默认推荐启动 webapp**。
