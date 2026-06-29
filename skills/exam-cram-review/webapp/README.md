# exam-cram-review 网页训练器

> 本地静态网页训练器 — 给 skill 生成的复习文档加上交互层（自测/计分/薄弱点追踪/可视化地图）

## 设计哲学：训练端 ≠ 阅读端

webapp 与 MD 编辑器**互补**而非替代：

| 角色 | MD 编辑器（Obsidian/VS Code/Typora/...） | webapp |
|------|---------|--------|
| **核心场景** | 沉浸阅读 + 写自己的批注/笔记 | 主动训练 + 错题追踪 + 可视化进度 |
| **数据流** | 读写 MD 源文件 | 只读 MD，写入浏览器 LocalStorage |
| **优势** | 跨设备同步、自由编辑、原生 KaTeX | 自测计分、错题追踪、知识地图、键盘训练 |
| **替代关系** | webapp 不修改 MD，主人随时可在编辑器加笔记 | webapp 不依赖 Obsidian Graph View（自带知识地图）|

**起源说明**：早期版本绑定 Obsidian 是因为 Obsidian 的 Graph View 用于章节关系可视化。现在 webapp 自带知识地图后，**MD 阅读端可以是任意编辑器**——主人在「编辑器」按钮配置首选编辑器即可。

## 启动方式

### 方式 A：双击打开（推荐，无依赖）

直接双击 `index.html` 用浏览器打开。
- ⚠️ Chrome 在 `file://` 协议下可能因 CORS 限制 KaTeX/Cytoscape CDN 加载，建议用方式 B
- 数据保存在浏览器 LocalStorage（每个浏览器/文件独立）

### 方式 B：本地静态服务器（推荐）

```bash
cd webapp
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

或 Node.js：
```bash
npx serve webapp
```

## 使用流程

1. **首次启动** → 点击「选择目录」按钮，浏览到 `ai复习/` 目录
2. **配置编辑器**（可选） → 点击顶栏「⚙ 编辑器」配置首选 MD 编辑器和 Vault 绝对路径
3. **加载完成** → 浏览器解析所有章节 MD 文件
4. **开始练习**：
   - **仪表盘**：全局统计、各章掌握度、最近错题清单（每行可点 📝 跳转到编辑器 / 🤖 AI 讲解）
   - **知识地图**：HTML 索引卡式章节节点（带胶带/进度环/手帐微倾斜），双击展开考点子图
   - **自测**：一题一屏 + 「自测题/例题练习」双 tab + 「🤖 让 AI 讲解」按钮。键盘快捷键：空格揭示答案 / J 答对 / K 答错 / 方向键切题
   - **公式速查**：手帐风纸卡 + 胶带配色（必背粉/熟悉黄/了解蓝）+ Anki 3D 翻转卡牌背诵
   - **✨ AI 出题**（新增）：选章节 → 选知识源 → 选题型/难度/数量 → 流式生成 → 加入题库 / 导出 Markdown

## ✨ AI 功能（新增）

### 浏览器直连 OpenAI 兼容 API

支持以下平台，只需切换 Base URL（API Key 仅存浏览器 LocalStorage，不经任何中间服务器）：

| 平台 | Base URL | 推荐场景 |
|------|---------|---------|
| DeepSeek | `https://api.deepseek.com/v1` | 国内最便宜，命题能力强 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | 免费额度大 |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | 长上下文友好 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 中文教材理解好 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | 聚合多家开源模型 |
| OpenAI | `https://api.openai.com/v1` | gpt-4o-mini 等 |
| 自部署 | `http://localhost:11434/v1` | Ollama / vLLM |

### 功能闭环

1. **AI 出题视图**：基于已选章节的 MD 材料生成新练习题，可加入题库或丢弃
2. **错题 AI 讲解**：仪表盘错题列表 + 自测视图都有 🤖 按钮，弹窗流式输出讲解
3. **题库导出**：生成的题目可一键导出为 Markdown，自动写入 Obsidian Callout 折叠答案

## 顶栏操作

- **⚙ 编辑器**：配置首选 MD 编辑器（Obsidian / VS Code / Typora / MarkText / 仅复制路径）
- **📁 换库**：重新选择 ai复习/ 目录，可加载不同课程

## 编辑器跳转协议

| 编辑器 | URL 协议 | 备注 |
|--------|---------|------|
| Obsidian | `obsidian://open?vault=<name>&file=<relpath>` | 需在 Obsidian 中已添加该 Vault |
| VS Code | `vscode://file/<absolute_path>` | 默认安装即可 |
| Typora | `typora-open://<absolute_path>` | macOS/Windows 默认注册 |
| MarkText | `marktext://<absolute_path>` | 部分版本需手动配置 |
| 复制路径 | （剪贴板） | 兜底方案，粘贴到任意编辑器 |

## 文件结构

```
webapp/
├── index.html         ← 入口
├── style.css          ← 泛黄笔记纸主题样式
├── app.js             ← 应用入口（视图调度/启动屏）
├── parser.js          ← MD 文件解析
├── storage.js         ← LocalStorage 数据持久化（含 AI 配置/题库字段）
├── ai-client.js       ← OpenAI 兼容协议客户端（流式 fetch）
├── editor.js          ← 编辑器跳转（多协议支持）
└── views/
    ├── dashboard.js   ← 仪表盘视图
    ├── map.js         ← 知识地图（Cytoscape + HTML 索引卡节点）
    ├── quiz.js        ← 自测/例题练习模式
    ├── formula.js     ← 公式卡片（胶带配色 + Anki 翻转）
    └── ai.js          ← ✨ AI 出题 / 错题讲解
```

## 视觉设计

整体采用**泛黄笔记纸**主题：

- 中文字体：[霞鹜文楷屏幕阅读版](https://github.com/lxgw/LxgwWenkaiScreen)（jsDelivr CDN）
- 英文手写：[Caveat](https://fonts.google.com/specimen/Caveat) + [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand)（Google Fonts）
- 配色：米黄纸张 + 褐色墨水 + 胶带高亮（粉/黄/蓝/绿）
- 微动效：卡片轻微倾斜、Hover 抬升、Anki 3D 翻转
- 纹理：笔记本横线 + SVG 噪点（性能开销极小）

## 技术栈

| 库 | 用途 | 加载方式 |
|----|------|---------|
| KaTeX | LaTeX 公式渲染 | CDN |
| marked | Markdown 解析 | CDN |
| Cytoscape.js | 知识地图可视化 | CDN |
| cytoscape-node-html-label | 节点 HTML 卡片渲染 | CDN |
| 霞鹜文楷 / Caveat / Patrick Hand | 字体 | CDN |

零构建、零打包、纯 Vanilla JS，便于二次修改。

## 数据隐私

- 所有数据存浏览器 LocalStorage
- 不向外部服务器发送任何内容
- 清除浏览器数据 = 重置所有进度

## 与 skill 工作流的集成

```
1. 主人触发 skill：「期末复习」
2. Skill 生成 ai复习/00_总索引.md + 各章节文件（5 类 MD + 图片）
3. Skill 提示主人启动 webapp（python -m http.server）
4. 主人在 webapp 选择 ai复习/ 目录 + 配置首选编辑器
5. 训练时数据存浏览器；需要批注笔记时点 📝 跳转编辑器
6. 多次回到 webapp 继续训练，无需重选目录
```

## 已知限制

- **CORS**：`file://` 协议下 CDN 资源可能加载失败，建议用 http.server
- **绝对路径**：浏览器无法自动获取 File API 的绝对路径，编辑器跳转需用户手动配置一次 Vault 路径
- **编辑器协议**：取决于本地是否注册了对应协议（默认安装通常都已注册）
- **Markdown 表格解析**：仅支持标准 GFM 表格语法，复杂嵌套表格可能解析不完整
