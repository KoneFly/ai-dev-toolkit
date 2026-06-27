# exam-cram-review 网页训练器

> 本地静态网页训练器 — 给 skill 生成的复习文档加上交互层（自测/计分/薄弱点追踪/可视化地图）

## 设计哲学

**Skill 负责内容生产，网页负责学习体验**：
- Skill 生成结构化 MD 文件（考点/例题/公式/真题/自测）
- 网页解析 MD 并提供四种学习模式：仪表盘 / 知识地图 / 自测 / 公式速查
- 所有学习数据存浏览器 LocalStorage，零后端依赖

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

### 方式 C：拖入 Obsidian Vault（仅查看 MD）

如果只想查看不需要交互训练，直接在 Obsidian 中打开 `ai复习/00_总索引.md` 即可。

## 使用流程

1. **首次启动** → 点击「选择目录」按钮，浏览到 `ai复习/` 目录
2. **加载完成** → 浏览器解析所有章节 MD 文件
3. **开始练习**：
   - **仪表盘**：全局统计、各章掌握度、最近错题清单
   - **知识地图**：交互式章节依赖图，节点颜色按正确率（绿/黄/红/灰）
   - **自测**：一题一屏，键盘快捷键：空格揭示答案 / J 答对 / K 答错 / 方向键切题
   - **公式速查**：默认遮盖公式列，点击行揭示；支持"随机测试"模式

## 文件结构

```
webapp/
├── index.html         ← 入口
├── style.css          ← 样式
├── app.js             ← 应用入口（视图调度/启动屏）
├── parser.js          ← MD 文件解析（章节/考点/例题/公式/自测）
├── storage.js         ← LocalStorage 数据持久化
└── views/
    ├── dashboard.js   ← 仪表盘视图
    ├── map.js         ← 知识地图（Cytoscape.js）
    ├── quiz.js        ← 自测模式
    └── formula.js     ← 公式遮盖模式
```

## 技术栈

| 库 | 用途 | 加载方式 |
|----|------|---------|
| KaTeX | LaTeX 公式渲染 | CDN |
| marked | Markdown 解析 | CDN |
| Cytoscape.js | 知识地图可视化 | CDN |

零构建、零打包、纯 Vanilla JS，便于二次修改。

## 数据隐私

- 所有数据存浏览器 LocalStorage
- 不向外部服务器发送任何内容
- 清除浏览器数据 = 重置所有进度

## 与 skill 工作流的集成

```
1. 主人触发 skill：「期末复习」
2. Skill 生成 ai复习/00_总索引.md + 各章节文件
3. Skill 提示主人启动 webapp（python -m http.server）
4. 在 webapp 中选择 ai复习/ 目录开始训练
5. 训练数据存浏览器；可重复回到 webapp 继续
```

## 已知限制

- **CORS**：`file://` 协议下 CDN 资源可能加载失败，建议用 http.server
- **Markdown 表格解析**：仅支持标准 GFM 表格语法，复杂嵌套表格可能解析不完整
- **公式提取**：依赖 skill 生成的 `03_公式手卡.md` 表格格式；若手卡为纯文本段落，提取的公式可能为空
- **依赖关系图**：从 `00_总索引.md` 中的 Mermaid 块解析 `Ch1 --> Ch2`，若总索引未使用此格式则地图无边
