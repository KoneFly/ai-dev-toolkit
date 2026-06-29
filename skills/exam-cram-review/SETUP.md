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
├── QUICKSTART.md         ← 30 秒快速开始
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
│   ├── formula-gen-prompt.md ← 子代理公式生成增强 prompt
│   ├── exam-mapping.md
│   └── self-test.md
├── scripts/
│   └── extract_office_batch.sh ← 批量提取辅助脚本
└── webapp/               ← 交互式训练器（泛黄笔记纸主题）
    ├── index.html
    ├── style.css         ← 笔记纸主题设计系统
    ├── app.js            ← 视图调度 + 启动屏
    ├── parser.js         ← MD 文件解析
    ├── storage.js        ← LocalStorage 持久化
    ├── editor.js         ← 编辑器跳转（Obsidian/VS Code/Typora）
    ├── ai-client.js      ← OpenAI 兼容 API 客户端（流式）
    └── views/
        ├── dashboard.js  ← 仪表盘（统计 + 错题）
        ├── map.js        ← 知识地图（Cytoscape + HTML 索引卡）
        ├── quiz.js       ← 自测/例题练习
        ├── formula.js    ← 公式卡片（Anki 3D 翻转）
        └── ai.js         ← ✨ AI 出题 / 错题讲解
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

---

## AI API 配置（可选）

webapp 的 ✨ AI 出题功能支持浏览器直连 OpenAI 兼容 API。此功能为**可选增强**，不配置不影响核心训练流程。

### 支持的平台

| 平台 | Base URL | 推荐场景 |
|------|---------|---------|
| DeepSeek | `https://api.deepseek.com/v1` | 国内最便宜，命题能力强 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | 免费额度大 |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | 长上下文友好 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 中文教材理解好 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | 聚合多家开源模型 |
| OpenAI | `https://api.openai.com/v1` | gpt-4o-mini 等 |
| 自部署 | `http://localhost:11434/v1` | Ollama / vLLM |

### 配置方式

1. 启动 webapp → 点击「✨ AI 出题」
2. 点击「配置」按钮
3. 选择预设平台或填写自定义 Base URL + Model 名
4. 填入对应平台的 API Key
5. 点击保存

### 数据安全

- API Key **仅存储于浏览器 LocalStorage**
- 所有 AI 请求由浏览器直接发起，**不经任何中间服务器**
- 清除浏览器数据即删除配置

### CORS 注意

大部分中国 AI 平台（DeepSeek/Kimi/GLM/通义/硅基流动）已开放浏览器 CORS，可直接调用。如使用自部署 Ollama，需启动时加 `OLLAMA_ORIGINS=* ollama serve` 或 `--cors` 标志。
