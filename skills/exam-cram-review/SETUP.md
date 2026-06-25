# exam-cram-review 环境初始化指南

> 本文档面向首次使用本 skill 的用户或 AI Agent，确保所有依赖就绪。

---

## 系统要求

| 项目 | 最低要求 | 推荐 |
|------|---------|------|
| OS | Windows 10+ / macOS 12+ / Linux (glibc 2.31+) | Windows 11 / Ubuntu 22.04 |
| Python | 3.8+ | 3.10+ |
| 磁盘空间 | 500MB（含 LibreOffice） | 1GB |
| Obsidian | 1.0+ | 最新版 |

---

## 依赖安装

### 1. Python 包（必需）

```bash
pip install PyMuPDF markitdown python-pptx
```

| 包名 | 用途 | 版本要求 |
|------|------|---------|
| `PyMuPDF` (fitz) | PDF 页面渲染、图片提取 | >=1.20 |
| `markitdown` | PPT/DOCX → Markdown 文本提取 | >=0.1 |
| `python-pptx` | PPT 内嵌图片直接提取 | >=0.6 |

### 2. LibreOffice（必需，用于格式转换）

**Windows：**
```powershell
# 推荐通过 winget 安装
winget install TheDocumentFoundation.LibreOffice

# 或手动下载：https://www.libreoffice.org/download/
# 安装后确保 soffice 在 PATH 中
# 默认路径：C:\Program Files\LibreOffice\program\soffice.exe
```

**macOS：**
```bash
brew install --cask libreoffice
```

**Linux：**
```bash
sudo apt install libreoffice-core libreoffice-impress libreoffice-writer
```

**验证安装：**
```bash
soffice --version
# 应输出：LibreOffice 7.x 或更高
```

### 3. Obsidian（用户端，非 AI 依赖）

复习文档的最终阅读器。确保：
- 已创建 Vault 并将输出目录纳入
- 启用 KaTeX 公式渲染（Settings → Editor → 开启 "Render math"）
- 无需额外插件（所有功能基于 Obsidian 核心）

---

## 环境验证脚本

运行以下命令确认所有依赖就绪：

```bash
python -c "
import sys
print(f'Python: {sys.version}')

try:
    import fitz
    print(f'PyMuPDF: {fitz.__version__} ✓')
except ImportError:
    print('PyMuPDF: NOT INSTALLED ✗ → pip install PyMuPDF')

try:
    import markitdown
    print(f'markitdown: installed ✓')
except ImportError:
    print('markitdown: NOT INSTALLED ✗ → pip install markitdown')

try:
    import pptx
    print(f'python-pptx: {pptx.__version__} ✓')
except ImportError:
    print('python-pptx: NOT INSTALLED ✗ → pip install python-pptx')

import subprocess
try:
    result = subprocess.run(['soffice', '--version'], capture_output=True, text=True, timeout=10)
    print(f'LibreOffice: {result.stdout.strip()} ✓')
except (FileNotFoundError, subprocess.TimeoutExpired):
    print('LibreOffice: NOT FOUND ✗ → 请安装 LibreOffice')
"
```

---

## 平台特定注意事项

### Windows

- **编码问题**：中文 `.doc` 文件转换后可能为 GBK/GB18030 编码。处理方式：
  ```bash
  iconv -f GB18030 -t UTF-8 < input.txt > output.txt
  ```
  Git Bash 的 iconv 不支持 `-o` 标志，必须用管道重定向。

- **Office COM 不可用**：Win11 上 PowerShell 的 Word/PowerPoint COM 接口经常报 `TYPE_E_CANTLOADLIBRARY`，**不要依赖 COM**，统一使用 LibreOffice headless 模式。

- **路径分隔符**：脚本中统一使用正斜杠 `/` 或 Python 的 `os.path`/`pathlib`。

### macOS / Linux

- LibreOffice headless 可能需要 `--headless --norestore` 双标志
- 中文字体渲染：确保系统安装了 CJK 字体包（如 `fonts-noto-cjk`）

---

## 目录结构说明

```
exam-cram-review/
├── SKILL.md              ← 主入口（自动触发规则 + 概览）
├── SETUP.md              ← 本文件（环境初始化）
├── LICENSE               ← MIT 许可证
├── references/
│   ├── workflow.md       ← 5+1 阶段完整工作流
│   ├── input-taxonomy.md ← 输入资料 4 级优先级
│   ├── output-templates.md ← 输出文档结构规范
│   └── obsidian-conventions.md ← Obsidian 兼容规范
├── templates/            ← 5 个 MD 输出模板（含占位符）
│   ├── keypoints.md
│   ├── examples.md
│   ├── formulas.md
│   ├── exam-mapping.md
│   └── self-test.md
└── scripts/
    └── extract_office_batch.sh ← 批量提取辅助脚本
```

---

## 给 AI Agent 的快速启动说明

如果你是一个 AI Agent 首次执行此 skill：

1. **先检查环境**：运行上面的验证脚本，缺什么装什么
2. **读 SKILL.md**：了解触发条件和完整流程概览
3. **读 references/workflow.md**：按 6 个阶段顺序执行
4. **PDF 偏移量**：扫描版 PDF 的页码 ≠ 书本页码，必须先手动翻几页确定偏移
5. **图片提取**：扫描版用 `page.get_pixmap()`，文字版用 `page.get_images()`
6. **编码陷阱**：中文 .doc 转 .txt 后检查编码，优先 GB18030 解码
7. **不要全文复述课本**：只提取真题/作业涉及的内容

---

## 常见问题

**Q: markitdown 报 UnsupportedFormatException？**
A: 文件是旧版 .ppt 格式，先用 `soffice --headless --convert-to pptx` 转换再处理。

**Q: PDF 页面提取出来是空白的？**
A: 可能页码偏移不对。手动翻 PDF 确认 offset。

**Q: Obsidian 中图片不显示？**
A: 确认图片文件在 Vault 内，且使用 `![[文件名.png]]` 而非 `![](路径)`。

**Q: LibreOffice 转换卡住不动？**
A: 加 `--norestore` 标志。如果仍有问题，杀掉残留的 soffice 进程后重试。
