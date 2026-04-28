# MCP 工具详细用法参考

> 本文件由主协议按需加载。两张总表（何时用哪个工具）在主协议中，此处提供**具体调用方式、降级策略和恢复要点**。

---


## Grok-Search MCP — 主要网络搜索工具（最高优先级）

**适用场景**：所有需要联网检索的场景，包括搜索开源驱动、查报错解决方案、查竞赛经验帖、搜索数据手册下载链接、查询最新版本信息等。

**实现**：GuDaStudio/GrokSearch（grok-with-tavily 分支），FastMCP 协议，提供三个 MCP 工具。

**三个工具**：

| 工具 | 功能 | 典型用途 |
|------|------|---------|
| `web_search` | Grok AI 搜索（主力） | 搜索驱动、排错方案、竞赛经验、数据手册链接 |
| `web_fetch` | Tavily Extract 网页内容提取 | 提取指定 URL 的结构化内容（需 Tavily API） |
| `web_map` | Tavily Map 站点地图 | 获取网站 URL 结构（需 Tavily API） |

**使用方式**（MCP 工具调用，非 CLI）：

```
# 基本搜索 — 使用 web_search 工具
web_search(query="STM32F103 SSD1306 OLED driver StdPeriph")

# 提取网页内容 — 使用 web_fetch 工具（需 Tavily API Key）
web_fetch(url="https://example.com/datasheet")

# 获取站点地图 — 使用 web_map 工具（需 Tavily API Key）
web_map(url="https://www.st.com/en/microcontrollers-microprocessors/stm32f103.html")
```

**推荐搜索关键词模板**：
- 驱动搜索：`STM32F103 SSD1306 OLED driver StdPeriph site:github.com`
- 报错排查：`STM32 HardFault handler cause and solution`
- 竞赛经验：`Chinese Electronic Design Contest PID motor control STM32`
- 数据手册：`STM32F103C8T6 Reference Manual PDF download site:st.com`
- 版本查询：`STM32CubeIDE latest version 2026`

**调用原则**（八荣八耻）：
- 以瞎猜接口为耻，以认真查询为荣 → 遇到不确定的信息，先用 grok-search 搜索
- 以臆想业务为耻，以人类确认为荣 → 搜索结果需引用来源，不凭空杜撰

**容灾备份**：
- grok-search 不可用时：第一降级 Claude WebSearch → 第二降级用户手动搜索 → Sequential Thinking 仅用于整理已获取证据（禁止用于事实检索）

---
## Context7 MCP — 固件库文档查询

适用：不确定 HAL / StdPeriph / ESP-IDF / Arduino 某个函数的参数含义、返回值、初始化顺序时

```
使用流程：
1. mcp__context7__resolve-library-id  libraryName="STM32 HAL"
2. mcp__context7__query-docs  libraryId=<返回的ID>  query="ADC DMA 初始化配置"
```

支持查询的嵌入式库：`STM32 HAL`、`STM32 StdPeriph`、`ESP-IDF`、`Arduino`、`FreeRTOS`、`CMSIS`

---

## 浏览器自动化 — 已由 `/playwright-skill` Skill 替代

> Playwright MCP 的功能已由 playwright-skill 替代。使用 `/playwright-skill` 触发，Claude 会自动编写 Playwright 脚本并执行。
>
> 典型使用场景：
> - 打开芯片数据手册网页，截图提取时序参数
> - 浏览器访问厂商网站，提取引脚复用表
> - 自动填写在线工具（如 STM32CubeMX 在线版）

---

## GitHub 操作 — 已由 `gh` CLI 替代

> GitHub MCP 的功能已由 `gh` 命令行工具替代，直接在 Bash 中调用即可。
>
> 常用命令：
> - `gh search repos "STM32F103 SSD1306 driver"` — 搜索驱动仓库
> - `gh api repos/owner/repo/contents/path` — 读取仓库文件内容
> - `gh repo clone owner/repo` — 克隆仓库到本地评估

---

## Document Skills — 主要文档阅读工具（最高优先级）

**适用场景**：所有需要读取/处理文档的场景，包括芯片数据手册 PDF、引脚映射 Excel 表、技术规格 Word 文档等。

**核心优势**：
- 基于 `uv run` + PEP 723，无需手动安装 Python 依赖
- 支持 PDF/DOCX/XLSX/PPTX 四种格式，覆盖嵌入式开发全部文档需求
- PDF 支持文本提取、表格提取、OCR 扫描页、表单填写、合并拆分

**四个 Skill**：

| Skill | 触发方式 | 嵌入式开发典型用途 |
|-------|---------|-------------------|
| `/pdf` | 处理 PDF 文件 | 芯片数据手册提取（寄存器表、引脚图、电气参数、时序图） |
| `/xlsx` | 处理 Excel 文件 | 引脚映射表、BOM 清单、测试数据分析 |
| `/docx` | 处理 Word 文件 | 技术规格文档、设计文档读写 |
| `/pptx` | 处理 PPT 文件 | 竞赛答辩、技术方案演示文稿 |

**PDF 快速用法**（最常用）：

```python
# 使用 /pdf skill — 直接告诉 Claude "读取这个 PDF" 即可自动调用
# 或手动执行：
from pypdf import PdfReader
reader = PdfReader("datasheet.pdf")
text = reader.pages[0].extract_text()  # 提取指定页文本

# 表格提取（引脚复用表、寄存器位域表）
import pdfplumber
with pdfplumber.open("datasheet.pdf") as pdf:
    tables = pdf.pages[45].extract_tables()
```

**容灾备份**：
- Document Skills 不可用时，降级到 Claude 内置 Read 工具（支持 PDF，最多 20 页/次）

**系统依赖**（按需安装）：
- 必需：`poppler`（已安装）
- 可选：`pandoc`（docx 转换）、`tesseract`（OCR）、`libreoffice`（格式转换）、`qpdf`（PDF 修复）

---

## Sequential Thinking MCP — 结构化决策推理

适用：架构设计阶段的复杂决策，需要逐步推理、假设验证、分支比较

```
推荐使用场景：
- 引脚冲突分析：多个外设竞争同一 GPIO 时的重映射决策
- DMA 通道分配：通道冲突时评估中断轮询替代方案的性能影响
- 中断优先级排布：多个时间敏感任务的抢占关系推理
- 故障排查：HardFault / 外设不响应等问题的根因分析链
```

---

## Embedded Debugger MCP — 实时硬件调试（需连接开发板）

适用：连接 J-Link / ST-Link / DAPLink 后进行实时调试

```
核心能力（22 个工具）：
- 固件烧录：flash_firmware → 直接烧录 .hex/.bin 到目标板
- 内存读写：read_memory / write_memory → 实时查看/修改寄存器值
- 断点调试：set_breakpoint / step → 单步跟踪执行流程
- RTT 双向通信：rtt_read / rtt_write → 替代 UART printf 调试
- 支持芯片：ARM Cortex-M (M0~M33)、RISC-V、STM32 全系列、nRF、ESP32-C
```

**注意**：此工具仅在物理连接开发板时可用，纯代码编写阶段无需调用。

---

## Serial MCP / mcp2serial — 串口通信

适用：通过 UART 与目标板交互，读取传感器数据、发送控制命令

```
Serial MCP Server（Rust 高性能版）：
- list_ports → 列出所有可用串口
- connect → 连接指定串口（波特率、数据位等）
- send / receive → 收发数据
- 适用场景：高频数据采集、实时串口监控

mcp2serial（Python 轻量版）：
- 同样功能，安装更简便（uvx 一键运行）
- 适用场景：简单串口调试、快速验证通信
```

---

## 工具降级与恢复策略

主协议只保留"优先级总表"。当需要具体降级方案、恢复条件和命令模板时，读取本节。

### 降级矩阵

| 主工具 | 不可用时的备用方案 | 降级影响 | 恢复条件 |
|--------|-------------|---------|---------|
| **Context7 MCP** | 本地 refs / 官方 PDF → grok-search 搜索官方文档 | 需人工验证搜索结果 | Context7 服务恢复 |
| **grok-search MCP** | Claude WebSearch → 手动查询 | 搜索质量下降 | 网络恢复 + API 可用 |
| **gh CLI** | grok-search (`site:github.com`) → 手动访问 GitHub | GitHub 细节信息下降 | API 配额重置 |
| **Sequential Thinking MCP** | 人工推理 + WebSearch | 推理效率下降 | 服务恢复 |
| **Document Skills** | Claude 内置 Read 工具 → grok-search 搜索 | 文档处理能力降级 | Skill 恢复 |
| **Embedded Debugger MCP** | 串口日志 / 断言 / 寄存器转储 / 手工烧录 | 无法在线调试 | 硬件连接恢复 |

### 降级执行流程

1. 记录降级事件：工具名称、错误原因、时间、备份方案
2. 用备份方案完成原任务
3. 评估结果质量，不足时再追加搜索或请求用户资料
4. 在下一次同类任务前重新探测主工具是否恢复

### 常见场景模板

**1. Context7 不可用**

- STM32：先查 `refs/stm32-hal-api.md`、`refs/stm32-stdperiph-api.md`
- 其他平台：先用 grok-search 搜索官方 API 文档站
- 禁止凭记忆猜测函数签名

**2. grok-search 不可用**

- 第一降级：Claude WebSearch
- 第二降级：让用户手动搜索并给出链接/关键词
- Sequential Thinking 只能整理已拿到的证据，不能替代事实搜索

**3. gh CLI 不可用**

- 第一降级：grok-search + `site:github.com`
- 第二降级：用户手动访问 GitHub

**4. Document Skills 不可用**

- 第一降级：Claude 内置 Read 工具
- 第二降级：grok-search 搜索在线版数据手册或官方文档站

### 自动恢复原则

- grok-search、gh CLI：每次同类任务前重试一次
- Context7、Sequential Thinking：每 3-5 个相关任务后重试一次
- Document Skills：每次读文档前重试一次
