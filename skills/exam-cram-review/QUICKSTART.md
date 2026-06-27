# exam-cram-review 最简使用说明

## 30 秒上手

### 1. 装依赖

```bash
pip install PyMuPDF markitdown python-pptx
```

再装 [LibreOffice](https://www.libreoffice.org/download/)（用于 .ppt/.doc 转换）。

### 2. 装 Skill

```bash
cp -r exam-cram-review/ ~/.claude/skills/exam-cram-review/
```

### 3. 准备复习文件夹

把以下材料放在同一个文件夹内：

```
我的课程/
├── 复习重点.txt          ← 必需：老师划的重点/录音整理
├── 2024试卷.doc          ← 必需：至少 1 份往年真题
├── 课本.pdf              ← 推荐：教材 PDF
├── 第01讲.pptx           ← 推荐：课程 PPT
├── 第02讲.pptx
└── 作业.jpg              ← 可选：作业截图
```

**最低要求**：1 份考纲/重点 + 1 份真题。有这两个就能跑。

### 4. 触发

在 Claude Code 中说：

> "帮我用 `我的课程` 文件夹生成期末突击复习文档，输出到 `ai复习/`"

或包含以下任意关键词自动触发：
- 期末复习 / 突击复习 / 考前冲刺 / 生成复习文档

### 5. 产出

```
ai复习/
├── 00_总索引.md                ← 从这里开始读
├── 01_第1章_xxx/
│   ├── 01_考点清单.md          ← 考什么（★级标注）
│   ├── 02_例题精讲.md          ← 怎么做（含电路图）
│   ├── 03_公式手卡.md          ← 速查表（考场用）
│   ├── 04_真题映射.md          ← 真题↔例题对照
│   ├── 05_自测.md              ← 折叠答案练习
│   └── _figures/*.png          ← 从 PDF 提取的电路图
├── 02_第2章_xxx/
│   └── ...
└── _extracted/                 ← 中间产物，可删
```

用 **Obsidian** 打开 `00_总索引.md`，按"必出大题"顺序开始复习。

### 6. （可选）启动网页训练器

如果想要交互式做题、自动追踪薄弱点、可视化知识地图：

```bash
cd ~/.claude/skills/exam-cram-review/webapp
python -m http.server 8000
# 浏览器访问 http://localhost:8000
# 点击「选择目录」选择刚生成的 ai复习/
```

四种学习模式：仪表盘 / 知识地图 / 自测 / 公式速查。详见 [webapp/README.md](webapp/README.md)。

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 没有真题怎么办？ | 用作业题代替，放 jpg/png 即可 |
| PDF 是扫描版能用吗？ | 能，会自动提取整页图片 |
| PPT 是旧版 .ppt？ | 自动转 .pptx 再处理 |
| 文档乱码？ | 中文 .doc 转换后自动处理编码 |
| 图片没显示？ | 确认 Obsidian Vault 包含输出目录 |

---

## 完整文档

- 环境详细配置 → [SETUP.md](SETUP.md)
- Skill 规范与触发规则 → [SKILL.md](SKILL.md)
- 完整工作流 → [references/workflow.md](references/workflow.md)
