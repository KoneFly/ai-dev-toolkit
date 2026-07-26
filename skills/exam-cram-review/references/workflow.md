# Exam-Cram-Review 完整工作流

## 阶段 0：资料盘点（≤2 分钟）

```bash
# Glob 扫描所有可能的复习材料
*.pdf *.ppt *.pptx *.doc *.docx *.txt *.md *.jpg *.png
```

**输出物**：资料清单，按 P0/P1/P2 标注（见 input-taxonomy.md）。

**判定规则**：
- 含"重点"、"复习"字样的 txt/md → P0 考纲层
- 含"试卷"、"真题"、"试题"字样的 doc/docx → P0 题源层
- 教材类 PDF（厚度 >100 页）→ P1 知识层
- 课程 PPT → P1 知识层（讲课框架）
- 作业截图、习题图片 → P0 题源层（OCR 或 Vision 读取）

### 阶段 0.5：确认输出格式

资料盘点完成后，**必须询问用户**想要哪种输出：

```
请选择输出格式：
A. 仅精简 MD（3 文件/章 + data.json，以 webapp 为核心阅读界面）← 默认推荐
B. 精简 MD + 规整 MD（同上 + Obsidian/打印友好的排版版）
```

- 默认选 A（省 token、以 webapp 网页端为核心）
- 选 B 时在精简基础上追加排版（双链、Callout、注释），约多消耗 30% token
- webapp 内置「🖨 导出」可直接浏览器打印 PDF，无需 Pandoc/TeX Live
- 记住用户选择，在阶段 3 使用

---

## 阶段 1：批量预处理（5-15 分钟，按文件数量）

```bash
# 创建中间产物目录
mkdir -p {输出目录}/_extracted

# 老式.ppt → .pptx
soffice --headless --convert-to pptx --outdir {输出}/_extracted {所有.ppt}

# .doc → utf8 txt（中文需 iconv 修正）
soffice --headless --convert-to "txt:Text" --outdir {输出}/_extracted {所有.doc}
for f in {输出}/_extracted/*.txt; do
    iconv -f GB18030 -t UTF-8 "$f" > "$f.utf8" && mv "$f.utf8" "$f" || true
done

# .pptx / .docx → markdown
for f in {输出}/_extracted/*.pptx; do
    python -m markitdown "$f" > "${f%.pptx}.md"
done
```

**性能预算**：8 个 PPT (50MB 共)≈ 3 分钟；2 个 doc ≈ 30 秒。后台跑。

**故障处理**：
- markitdown 报 `UnsupportedFormatException` → 文件还是旧格式，回到 soffice 转换
- LibreOffice Impress 不支持直接 `--convert-to txt` → 必须先转 pptx 再用 markitdown
- LibreOffice 输出乱码 → stdout 直接读取通常已正确解码；若仍乱码则 iconv 管道 `iconv -f GB18030 -t UTF-8`
- PowerPoint/Word COM 路径**直接放弃**——Win11 上 Office Interop 易报 TYPE_E_CANTLOADLIBRARY / msoTriState 枚举解析失败
- Git Bash 的 iconv 不支持 `-o` 标志 → 用管道重定向 `iconv -f GBK -t UTF-8 < in > out`

---

## 阶段 1.5：关键电路图提取（5-10 分钟）

> 纯文字复习文档缺乏直观性，必须为必考电路提供对应的原始图片。

### 策略选择

| PDF 类型 | 判定方法 | 提取方式 |
|----------|---------|---------|
| **扫描版**（text=0，每页1张嵌入图） | `page.get_text()` 为空 | `page.get_pixmap(dpi=200)` 整页或裁剪区域渲染为 PNG |
| **文字版**（text 有内容） | `page.get_text()` 非空 | `page.get_images()` 提取嵌入位图；矢量图仍需 pixmap |

### 关键图片清单（按优先级）

每章需要提取的图片类型：

| 类型 | 嵌入位置 | 示例 |
|------|---------|------|
| **电路拓扑图** | 02_例题精讲 | 共源/共栅/差分对/cascode 原始电路 |
| **小信号等效电路** | 02_例题精讲 | 对应拓扑的小信号模型 |
| **I-V 特性曲线** | 01_考点清单 | MOS 三区 I-V、转移特性 |
| **版图/结构截面** | 01_考点清单 | MOS 管截面结构（如有） |

### 提取流程

```python
import fitz

doc = fitz.open("课本.pdf")
# 确定页码偏移：PDF页码 = 书本页码 + offset
# 先手动翻看几页确定 offset

def extract_figure(pdf_page_idx, clip_rect, output_path, dpi=200):
    """裁剪 PDF 指定页面区域为 PNG"""
    page = doc[pdf_page_idx]
    mat = fitz.Matrix(dpi/72, dpi/72)
    pix = page.get_pixmap(matrix=mat, clip=clip_rect)
    pix.save(output_path)
```

### 图片命名规范

```
{章节目录}/_figures/
├── fig_电路拓扑_{描述}.png     ← 原始电路图
├── fig_小信号_{描述}.png       ← 小信号等效电路
├── fig_特性曲线_{描述}.png     ← I-V / 频响等曲线
└── fig_结构_{描述}.png         ← 器件截面/版图
```

### Markdown 引用方式

```markdown
**电路图**：
![[_figures/fig_电路拓扑_共源放大器.png]]

**小信号等效电路**：
![[_figures/fig_小信号_共源放大器.png]]
```

### 备选：PPT 图片提取

PPT 中的图片通常为嵌入式 PNG/EMF，可用 `python-pptx` 直接提取：

```python
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

prs = Presentation("lecture.pptx")
for slide in prs.slides:
    for shape in slide.shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            image = shape.image
            image_bytes = image.blob
            # 保存为 PNG
```

### 注意事项

- **扫描版 PDF 偏移量**：必须先手动确认 PDF 页码与书本页码的对应关系（通常有 8-10 页前言偏移）
- **裁剪精度**：首次提取后检查图片边界，必要时微调 `clip_rect`
- **文件大小**：单张图 ≤200KB（dpi=200 通常足够），总图片 ≤20MB
- **仅提取必考图**：不要提取每一页——只提取在 02_例题精讲 和 01_考点清单 中实际被引用的关键电路

---

## 阶段 2：锚点构建（10-20 分钟）

### 2.1 通读考纲层

逐字读老师的"重点笔记"。提取：
- 章节顺序（哪几章要考、哪几章跳过）
- 题型分布（选择/填空/简答/计算 各占多少分）
- 关键考点 + 星级（"一定考"=★★★，"会考"=★★，"可能考"=★）
- 明确禁止项（"不考"、"不会考"、"默认会"）

### 2.2 解析题源层

对每份真题：
1. 拆题：每道题独立编号（如 `2024B-单选-3`）
2. 打标签：归属到考纲列出的章节
3. 提取考点：每题考的是什么概念/方法
4. 难度评估：1-5 星

**输出结构**：
```yaml
2024B:
  单选:
    - id: 1, topic: 工作区判定, 章节: 第1章
    - id: 2, topic: PMOS载流子, 章节: 第1章
  ...
  计算:
    - id: 1, topic: 差分放大共模输入范围, 章节: 第4章, 难度: 4
```

### 2.3 频次表

跨真题统计每个考点的出现次数。**出现≥2 次的就是必考**。

### 2.4 反向追溯

对每个必考考点：
- 找课本中对应的例题（按页码、按公式编号）
- 找 PPT 中对应的页（按标题、按图编号）
- 记录引用：`{考点} → [{课本.pdf#P55例2.7}, {第04讲PPT.md#L120}]`

---

## 阶段 3：分章生成（每章 10-20 分钟）

按章节循环。对每章生成 3 个 MD 文件，同时在内存中构建 data.json 所需的结构化数据。

> **核心原则**：以 webapp 网页端为主阅读界面，MD 默认精简（省 token）。data.json 是 webapp 的唯一可靠数据源。

### 3.1 `讲解.md`（考点清单 + 例题精讲，合并原 01+02）

**精简版**（默认）：直接列出考点和例题，无需追求 Obsidian 排版。

```markdown
# 第N章 {章节名}

章节重要性：★★★

### 1. {考点标题} ★★★

{考点核心内容，1-3 段}

### 2. {考点标题} ★★

{考点核心内容}

---

## 例 N.M（书本 P{页}）

> 原题：...

**考点**：{考点}（★★★）

**解答**：...
```

**data.json 对应字段**：
- `keypoints[]`: `{number, title, star, body}` — body 为考点内容的 markdown 原文
- `examples[]`: `{title, body}` — body 为例题完整内容

### 3.2 `题库.md`（真题映射 + 自测题，合并原 04+05）

```markdown
# 题库

## 真题映射

### 2024-B 卷 第N章相关题

{真题内容及解析}

---

## 自测

### 自测 1

{题干}

> [!faq]- 点击展开答案
> {答案}
```

**data.json 对应字段**：
- `examMapping`: 真题映射的 markdown 原文（整篇）
- `quizQuestions[]`: `{title, question, answer}` — 从自测题解析

### 3.3 `速查.md`（公式手卡，= 原 03）

格式与之前 `03_公式手卡.md` 完全一致（H2 详细块 + 末尾速查表）。

**data.json 对应字段**：
- `formulas[]`: `{name, formula, condition, note, importance, meaning, derivation, application, related}`

详细模板见 [`templates/formulas.md`](../templates/formulas.md)。

### 3.6 写 data.json（阶段 3 末尾，所有章节生成完毕后）

将内存中构建的章节结构序列化为 `{输出目录}/data.json`：

```json
{
  "version": 1,
  "vaultName": "{科目名}",
  "generatedAt": "2026-07-26",
  "masterIndexContent": "(00_总索引.md 的 mermaid 原文，供 webapp 解析 deps)",
  "chapters": {
    "01": {
      "id": "01",
      "slug": "01_第1章_MOS器件",
      "number": 1,
      "name": "第1章 MOS器件",
      "star": 3,
      "keypoints": [{"number": 1, "title": "...", "star": 3, "body": "markdown"}],
      "examples": [{"title": "例1.1", "body": "markdown"}],
      "formulas": [{"name": "...", "formula": "$$...$$", "condition": "...", "note": "...",
                     "importance": "must", "meaning": "...", "derivation": "...",
                     "application": "...", "related": "..."}],
      "quizQuestions": [{"title": "自测1", "question": "md", "answer": "md"}],
      "examMapping": "markdown 字符串",
      "deps": ["01"],
      "depTypes": {"02": "tool"},
      "files": {"讲解.md": "01_第1章_MOS器件/讲解.md", "题库.md": "...", "速查.md": "..."}
    }
  }
}
```

**关键**：
- 每个字段**直接结构化写入**，不依赖 MD 正则解析
- `formulas[].importance` 必须是 `"must"|"familiar"|"know"|"normal"` 之一
- `files` 字段用于 webapp 的「在编辑器中打开」功能
- webapp parser.js 优先读此文件，读到后**跳过全部 MD 解析**

---

## 阶段 4：总索引（5 分钟）

`00_总索引.md` 必含：

```markdown
# {科目} 期末复习总览

## 考试信息
- 时间：{从用户处获得}
- 题型分布：{从复习重点提取}
- 考纲：[[复习重点 source]]

## 章节地图

\`\`\`mermaid
graph LR
  Ch1[第1章 基础]:::core --> Ch2[第2章]:::core
  Ch2 --> Ch3
  Ch2 --> Ch4
  classDef core fill:#f9d
\`\`\`

## 章节索引

| 章节 | 重要性 | 入口 |
|------|--------|------|
| 第1章 | ★★★ | [[01_第1章/01_考点清单]] |
| ... | ... | ... |

## 突击建议

| 剩余天数 | 重点 |
|----------|------|
| ≤2 天 | 只看 速查.md（公式）+ webapp 公式 Anki 模式 |
| 3-5 天 | 加 讲解.md（仅★★★考点）+ webapp 自测 |
| 6+ 天 | 全部 + webapp AI 出题扩展练习 |
```

---

## 阶段 5：交付与回顾（2-5 分钟）

- 报告生成文件数、字数、覆盖的考点数
- 列出**未覆盖的资料**（被跳过的 PPT 页/PDF 章）并说明理由
- **默认推荐启动 webapp**

### 5.1 webapp 提示（默认）

```
复习文档已生成！推荐启动网页训练器：
cd {skill目录}/webapp && python -m http.server 8000
浏览器访问 http://localhost:8000，选择 {输出目录}

webapp 提供：📊 总览 / 📖 阅读 / ✍️ 练习（含 AI 出题）
内置「🖨 导出」按钮可直接打印 PDF
```

### 5.2 规整 MD 补充（若用户在阶段 0.5 选择了 B）

在精简 MD 基础上，对每章 3 个文件追加：
- Obsidian 双链（`[[讲解#考点名]]`、`[[题库#真题ID]]`）
- Callout 折叠答案格式
- 注释补充、段落排版美化
- 不改变文件结构，仅增强可读性

---

## 性能边界

- 总耗时上限：≤90 分钟（含所有 IO）
- 主上下文消耗：≤60K tokens（PPT 提取后建议派给子代理总结）
- 文档总字数：≤8 万字（突击场景看不完更多）

---

## 大 PDF 应对策略（重要：避免上下文爆炸）

**问题**：典型大学教材 PDF 200-400 页，全文 300k-600k tokens，**绝不能一次读入**。

### 三道防线

**防线 1：反向工程哲学（最重要）**

```
错误流程：从头到尾读 PDF → 整理考点 → 写文档
正确流程：读复习重点+真题 → 提取考点 → 反向追溯到 PDF 特定页 → 只读那几页
```

→ 主代理对 PDF 的访问应该 **<10 次 Read 调用，每次 ≤20 页**。

**防线 2：图片提取走文件系统**

- 用 PyMuPDF `page.get_pixmap()` 或 `doc.extract_image()` 直接保存到磁盘（PNG）
- 这些图片字节**不进入 LLM 上下文**，0 token 消耗
- 仅在 MD 文档中以 `![[_figures/xxx.png]]` 引用

**防线 3：子代理隔离上下文**

- 复杂的"在 PDF 中找某个例题"任务派给 `Explore` agent
- 子代理用自己的上下文窗口读 PDF，返回主代理 1-2k tokens 摘要
- 主代理 100% 用于生成最终 MD，不被原始资料污染

### 检测与预处理

```python
import fitz
doc = fitz.open(pdf_path)
total_pages = doc.page_count

# 决策树
if total_pages > 200:
    # 超大教材：必须走"按需读取"模式
    # 1. 先生成全书目录索引（每页前 200 字符）
    # 2. 主代理永远不通读，只读特定页
    pass
elif total_pages > 100:
    # 中等教材：可以分批读取关键章节
    pass
else:
    # 小册子：允许通读，但仍建议分批
    pass

# 检测扫描版（无文字层）
is_scanned = doc[10].get_text().strip() == ''
if is_scanned:
    # 扫描版必须用 pixmap 渲染再 OCR/视觉理解
    # 不要尝试 get_text()
    pass
```

### 决策矩阵

| 资料 | 必读？ | 推荐处理 |
|------|--------|---------|
| 复习重点.txt | **必读全文** | 整篇 Read（决定输出结构）|
| 真题.doc | **必读全文** | 整篇 Read（决定考点频次）|
| PPT.md（提取后）| 摘要读 | 每份 ≤500 行，按章节扫描 |
| **大 PDF 教材** | **按需读** | 仅在反向追溯到具体例题时 Read 该页 ±5 页 |
| 作业截图 | 必读 | Read 工具支持图像直接读 |

### 主人课本案例（已验证）

主人的 CMOS 模拟集成电路 PDF 是 5MB / 375 页（扫描版）。浮浮酱实际处理：

- Read 次数：约 6-8 次（每次 20 页，主要为读特定例题页）
- PyMuPDF 提取图片：24 张（写盘，不进上下文）
- **主上下文 PDF 相关 tokens 占用：~30k**（远低于 60k 预算）
- **如果通读这本 PDF：~500k tokens（不可能）**

→ 反向工程策略让一本几百页教材的处理变得可控。

### 极端情况：PDF >100MB

如果遇到超大 PDF（含高分辨率图）：

1. 用 `pdftk` 或 `pdfseparate` 拆成单页 PDF
2. 用 `mutool clean -gg` 压缩（去除重复字体/图）
3. 用 `python-pdfsplit` 按章节拆成多个小文件
4. 实在不行：让用户手动指定"只看第 N-M 页"

---

## 反模式（避免做的事）

1. **不要全文复述课本**——只引用真题/作业涉及的部分
2. **不要手绘电路图**——从课本 PDF/PPT 提取原始图片（PyMuPDF pixmap 或 python-pptx），确保准确性
3. **不要重新定义术语**——参考 [[03_公式手卡]] 即可
4. **不要做长篇引言**——突击场景，开门见山
5. **不要生成中英对照**——除非用户要求
6. **不要通读大 PDF**——见上"大 PDF 应对策略"，永远走"真题锚点→反向追溯→定点读取"
6. **不要用 emoji**——污染 Obsidian 大纲视图
