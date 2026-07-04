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
A. 仅 Markdown（Obsidian/Typora/VS Code 阅读）
B. Markdown + PDF（Pandoc + XeLaTeX 编译，公式排版更稳定）
C. Markdown + webapp（交互训练 + 错题追踪）
D. 全部（MD + PDF + webapp）← 默认推荐
```

- 用户选 B 或 D 时，检查 `pandoc --version` 和 `xelatex --version`
- 未安装则提示："PDF 输出需要安装 Pandoc + TeX Live，详见 SETUP.md。是否跳过 PDF 先生成 MD？"
- 记住用户选择，在阶段 5 使用

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
| **版图/结构截面** | 01_考点清单 | MOS 管截面结构（如有）|

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

## 阶段 3：分章生成（每章 15-30 分钟）

按章节循环。对每章：

### 3.1 `01_考点清单.md`

- 用考纲层的描述作为骨架
- 每个考点标★级
- 列出该考点出现的真题题号（双链）
- 列出该考点对应的课本/PPT 位置（路径+页码）

### 3.2 `02_例题精讲.md`

只精讲两类题：
- 老师明确说"作业一定要做"的例题
- 真题中出现过的题型对应的例题

每题结构：
```markdown
## 例 N.M（书本 P{页}）

> 原题：...

**考点**：{考点}（★★★）

**分析**：
1. 第一步：...
2. 第二步：...

**关键公式**：
$$ ... $$

**解答**：
...

**相关真题**：[[04_真题映射#2024B-计算1]]
```

### 3.3 `03_公式手卡.md`

**两种格式并存（必须按此顺序）**：

#### 主体：H2 详细公式块（必须，供 webapp Anki 模式与关联高亮使用）

```markdown
## {{公式名}}（公式 N.M，必背|熟悉|了解）

$$ {{LaTeX 公式}} $$

**物理含义**：1-2 句物理图像

**适用条件**：xxx

**推导起点**：从 公式 X.Y 推得 *— 务必含 "公式 N.M" 字样*

**应用场景**：- 真题/例题中的典型应用

**关联公式**：见 公式 N.M、公式 N.M+1
```

#### 末尾：速查表（可选，考场对照）

```markdown
## 速查表

| 编号 | 公式 | 条件 | 备注 |
|------|------|------|------|
| 1.1 | $I_D = \frac{1}{2}\mu_n C_{ox}\frac{W}{L}(V_{GS}-V_{th})^2$ | 饱和区 | 萨氏方程 |
```

**关键 Parser 兼容性要求**（必须遵守，否则 webapp 公式卡丢字段）：
- 每条主要公式用 `## H2 标题` 包含 `（公式 N.M, 重要级）` 字段
- `**物理含义**：` / `**适用条件**：` / `**推导起点**：` / `**应用场景**：` 必须是加粗段（parser.js extractFormulaMeta 依赖此格式）
- 关联引用必须写成 `公式 N.M`（中间可有/无空格），parser 用正则 `公式\s*\d+\.\d+` 自动捕获
- 重要级关键词 `必背|必记|必考|必出` 写在 H2 标题中 → webapp 显示红色徽章
- 详细模板：见 [`templates/formulas.md`](../templates/formulas.md) 与 [`templates/formula-gen-prompt.md`](../templates/formula-gen-prompt.md)（供子代理直接复用的强化 prompt）

### 3.4 `04_真题映射.md`

```markdown
## 2024-B 卷 第N章相关题

### 单选 3：{题干}

- **答案**：B
- **考点**：[[01_考点清单#考点-X]]
- **课本支撑**：[[课本.pdf#P{页}]]
- **解析**：...

### 计算 1：{题干}

- **完整解答**：...
- **此题对应例题**：[[02_例题精讲#例N.M]]
```

### 3.5 `05_自测.md`

```markdown
## 自测题 N.1

{题干}

> [!faq]- 点击展开答案
> {答案}
> 
> **解析**：...
```

题目来源：基于该章节真题改编（换数字、换方向），约 5-8 题。

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
| ≤2 天 | 只看 03_公式手卡 + 04_真题映射 |
| 3-5 天 | 加 01_考点清单 + 02_例题精讲（仅★★★） |
| 6+ 天 | 全部 + 05_自测 |
```

---

## 阶段 5：交付与回顾（2-5 分钟）

- 报告生成文件数、字数、覆盖的考点数
- 列出**未覆盖的资料**（被跳过的 PPT 页/PDF 章）并说明理由
- 提供 Obsidian 打开命令：`obsidian://open?vault={vault}&file=00_总索引.md`

### 5.1 PDF 编译（若用户在阶段 0.5 选择了 B 或 D）

```bash
# 检查依赖
pandoc --version && xelatex --version

# 执行批量转换
bash ~/.claude/skills/exam-cram-review/scripts/md2pdf.sh "{输出目录}"
# PDF 输出到 {输出目录}/_pdf/
```

- 每章的 5 个 MD 合并为 1 个 PDF（按 01-05 编号排序）
- 使用 `templates/pandoc-header.tex` 配置中文字体（SimSun）+ 数学公式包
- 若 Pandoc/XeLaTeX 未安装，打印提示并跳过（不阻塞 MD 交付）
- 编译失败的章节单独报告（常见原因：不支持的 Mermaid 图表 → 建议手动删除后重试）

### 5.2 webapp 提示（若用户选择了 C 或 D）

```
如需交互式训练，启动网页训练器：
cd {skill目录}/webapp && python -m http.server 8000
浏览器访问 http://localhost:8000，选择 {输出目录}
```

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
