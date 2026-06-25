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

**密度优先**，不写解释。考场对照用：

```markdown
## 第N章 公式速查

| 编号 | 公式 | 条件 | 备注 |
|------|------|------|------|
| 1.1 | $I_D = \frac{1}{2}\mu_n C_{ox}\frac{W}{L}(V_{GS}-V_{th})^2$ | 饱和区 | 萨氏方程 |
| 1.2 | $g_m = \mu_n C_{ox}\frac{W}{L}(V_{GS}-V_{th})$ | 饱和区 | 跨导 |
...
```

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

## 阶段 5：交付与回顾（2 分钟）

- 报告生成文件数、字数、覆盖的考点数
- 列出**未覆盖的资料**（被跳过的 PPT 页/PDF 章）并说明理由
- 提供 Obsidian 打开命令：`obsidian://open?vault={vault}&file=00_总索引.md`

---

## 性能边界

- 总耗时上限：≤90 分钟（含所有 IO）
- 主上下文消耗：≤60K tokens（PPT 提取后建议派给子代理总结）
- 文档总字数：≤8 万字（突击场景看不完更多）

---

## 反模式（避免做的事）

1. **不要全文复述课本**——只引用真题/作业涉及的部分
2. **不要手绘电路图**——从课本 PDF/PPT 提取原始图片（PyMuPDF pixmap 或 python-pptx），确保准确性
3. **不要重新定义术语**——参考 [[03_公式手卡]] 即可
4. **不要做长篇引言**——突击场景，开门见山
5. **不要生成中英对照**——除非用户要求
6. **不要用 emoji**——污染 Obsidian 大纲视图
