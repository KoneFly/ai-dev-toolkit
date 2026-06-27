/* ==============================================================
 * parser.js - 解析 ai复习/ 目录下的 Markdown 文件
 * 输出统一的章节数据结构供各视图消费
 * ============================================================== */

(function (global) {
  'use strict';

  /**
   * 章节数据结构
   * {
   *   id: '01',                    // 课本章号（两位）
   *   slug: '01_第1章_MOS器件',     // 目录名
   *   name: '第1章 MOS器件',
   *   number: 1,
   *   star: 3,                     // 重要性 1-5
   *   keypoints: [{title, star, body}],
   *   examples: [{title, body}],
   *   formulas: [{name, formula, condition, note}],
   *   quizQuestions: [{question, answer, raw}],
   *   examMapping: '...',
   *   deps: ['01']                 // 依赖章节（从总索引解析）
   * }
   */

  const Parser = {};

  /**
   * 从 File 数组构建章节字典
   * @param {File[]} files - webkitdirectory 选择得到的所有文件
   * @returns {Promise<{chapters: Object, master: Object}>}
   */
  Parser.parseFromFiles = async function (files) {
    const chapters = {};
    let masterIndexContent = '';

    // 第一遍：按目录归类
    const fileMap = {}; // { '01_第1章_MOS器件': { '01_考点清单.md': File, ... } }
    for (const f of files) {
      const path = f.webkitRelativePath || f.name;
      const parts = path.split('/');

      if (parts.length === 2 && parts[1] === '00_总索引.md') {
        masterIndexContent = await readText(f);
        continue;
      }
      if (parts.length >= 3 && parts[1].match(/^\d{2}_第\d+章/)) {
        const dir = parts[1];
        const fname = parts[2];
        if (!fileMap[dir]) fileMap[dir] = {};
        fileMap[dir][fname] = f;
      }
    }

    // 第二遍：解析每章
    for (const dir in fileMap) {
      const m = dir.match(/^(\d{2})_第(\d+)章[_-]?(.*)$/);
      if (!m) continue;
      const ch = {
        id: m[1],
        slug: dir,
        number: parseInt(m[2]),
        name: `第${m[2]}章 ${m[3]}`,
        star: 3,
        keypoints: [],
        examples: [],
        formulas: [],
        quizQuestions: [],
        examMapping: '',
        deps: []
      };
      const f = fileMap[dir];
      if (f['01_考点清单.md']) {
        const content = await readText(f['01_考点清单.md']);
        ch.keypoints = parseKeypoints(content);
        ch.star = extractStar(content);
      }
      if (f['02_例题精讲.md']) {
        ch.examples = parseExamples(await readText(f['02_例题精讲.md']));
      }
      if (f['03_公式手卡.md']) {
        ch.formulas = parseFormulas(await readText(f['03_公式手卡.md']));
      }
      if (f['04_真题映射.md']) {
        ch.examMapping = await readText(f['04_真题映射.md']);
      }
      if (f['05_自测.md']) {
        ch.quizQuestions = parseQuizQuestions(await readText(f['05_自测.md']));
      }
      chapters[ch.id] = ch;
    }

    // 解析总索引的章节关系
    const deps = parseMasterIndexDeps(masterIndexContent);
    for (const [from, toList] of Object.entries(deps)) {
      if (chapters[from]) {
        chapters[from].deps = toList.filter(t => chapters[t]);
      }
    }

    return { chapters, masterIndexContent };
  };

  /* ============== 辅助：读取 File 文本 ============== */
  function readText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsText(file, 'utf-8');
    });
  }

  /* ============== 解析星级 ============== */
  function extractStar(text) {
    const m = text.match(/章节重要性[：:]\s*(★+)/);
    if (m) return m[1].length;
    return 3;
  }

  /* ============== 解析考点清单 ============== */
  function parseKeypoints(text) {
    // 形如 ### 1. NMOS/PMOS 工作原理 直至下一个同级 heading 或文件结束
    const result = [];
    const re = /^###\s+(\d+)\.\s+(.+?)$/gm;
    const matches = [...text.matchAll(re)];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const start = m.index + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const body = text.slice(start, end).trim();
      const star = (m[2].match(/★/g) || []).length;
      result.push({
        number: parseInt(m[1]),
        title: m[2].replace(/★+/g, '').trim(),
        star: star || 3,
        body
      });
    }
    return result;
  }

  /* ============== 解析例题精讲 ============== */
  function parseExamples(text) {
    const result = [];
    const re = /^##\s+(例[\s\S]+?)$/gm;
    const matches = [...text.matchAll(re)];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      result.push({
        title: matches[i][1].trim(),
        body: text.slice(start, end).trim()
      });
    }
    return result;
  }

  /* ============== 解析公式手卡（Markdown 表格 + 公式区块）============== */
  function parseFormulas(text) {
    const result = [];
    // 策略：先抽所有「## 子标题」分组，组内识别 boxed 公式或表格行
    const sections = splitByHeading(text, '##');
    // 跟踪同名子标题计数器，避免"核心公式"重复
    const titleCounter = {};

    for (const sec of sections) {
      const cleanTitle = stripFormulaNoise(sec.title);
      const blockFormulas = extractBlockFormulas(sec.body);

      for (let idx = 0; idx < blockFormulas.length; idx++) {
        // 多公式 + 通用标题 → 加序号
        let name = cleanTitle;
        if (blockFormulas.length > 1 || isGenericTitle(cleanTitle)) {
          titleCounter[cleanTitle] = (titleCounter[cleanTitle] || 0) + 1;
          name = `${cleanTitle} #${titleCounter[cleanTitle]}`;
        }
        result.push({
          name,
          formula: blockFormulas[idx],
          condition: extractCondition(sec.body),
          note: extractNote(sec.body, sec.title)
        });
      }

      // 2) 抽 Markdown 表格中的公式
      const tableRows = parseMarkdownTable(sec.body);
      for (const row of tableRows) {
        // 表格行可能有多种 schema，常见列：编号|公式|条件|备注 或 公式|条件|...
        const fcol = row.find(c => c.includes('$'));
        if (!fcol) continue;
        const nameRaw = row.find(c => !c.includes('$') && c.length < 30) || sec.title;
        result.push({
          name: nameRaw.replace(/\*\*/g, '').trim() || sec.title,
          formula: fcol,
          condition: row.find(c => c !== fcol && /区|时|当|>|</.test(c)) || '',
          note: row[row.length - 1] !== fcol ? row[row.length - 1] : ''
        });
      }
    }
    return result;
  }

  /* ============== 解析自测题 ============== */
  function parseQuizQuestions(text) {
    const result = [];
    // 形如 `## 自测 N` 或 `## 自测 N（X 分）`，包含一段题目和一个 [!faq]- 折叠答案
    const re = /^##\s+自测[\s\S]*?(?=^##\s+|\Z)/gm;
    const blocks = text.match(/##\s+自测[\s\S]*?(?=\n##\s+|$)/g) || [];
    for (const block of blocks) {
      const titleMatch = block.match(/^##\s+(.+?)$/m);
      const title = titleMatch ? titleMatch[1].trim() : '自测';

      // 找 callout
      const calloutIdx = block.search(/^>\s*\[!faq\]/m);
      let question, answer;
      if (calloutIdx > 0) {
        // 题目 = 标题之后 到 callout 之前
        question = block.slice(titleMatch.index + titleMatch[0].length, calloutIdx).trim();
        // 答案 = callout 内所有以 > 开头的行去 >
        const calloutPart = block.slice(calloutIdx);
        answer = calloutPart
          .split('\n')
          .map(line => line.replace(/^>\s?/, ''))
          .filter(line => !line.match(/^\[!faq\]/))
          .join('\n')
          .trim();
      } else {
        question = block.replace(titleMatch[0], '').trim();
        answer = '（未提供答案）';
      }
      result.push({ title, question, answer, raw: block });
    }
    return result;
  }

  /* ============== 解析总索引中的章节依赖 ============== */
  function parseMasterIndexDeps(text) {
    // 从 Mermaid 图块中提取 ChX --> ChY 或 ChX -.-> ChY
    const deps = {};
    const mermaidRe = /```mermaid[\s\S]*?```/g;
    const blocks = text.match(mermaidRe) || [];
    for (const block of blocks) {
      const edgeRe = /Ch(\d+)\s*-[.->\s]*->\s*Ch(\d+)/g;
      let m;
      while ((m = edgeRe.exec(block))) {
        const from = m[1].padStart(2, '0');
        const to = m[2].padStart(2, '0');
        if (!deps[from]) deps[from] = [];
        if (!deps[from].includes(to)) deps[from].push(to);
      }
    }
    return deps;
  }

  /* ============== 工具函数 ============== */

  /**
   * 提取 $$...$$ 块级公式，正确处理嵌套 {}（不用正则避免回溯爆炸）
   */
  function extractBlockFormulas(text) {
    const formulas = [];
    let i = 0;
    while (i < text.length) {
      const start = text.indexOf('$$', i);
      if (start < 0) break;
      const end = text.indexOf('$$', start + 2);
      if (end < 0) break;
      const raw = text.slice(start, end + 2);
      // 跳过空块
      if (raw.length > 5) formulas.push(raw.trim());
      i = end + 2;
    }
    return formulas;
  }

  function splitByHeading(text, prefix) {
    const reEsc = prefix.replace(/[#]/g, '\\#');
    const re = new RegExp(`^${reEsc}\\s+(.+?)$`, 'gm');
    const matches = [...text.matchAll(re)];
    const out = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      out.push({ title: matches[i][1].trim(), body: text.slice(start, end).trim() });
    }
    return out;
  }

  function parseMarkdownTable(text) {
    const rows = [];
    const lines = text.split('\n');
    let inTable = false;
    let headerSeen = false;
    for (const line of lines) {
      if (line.trim().startsWith('|')) {
        const cols = line.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
        if (cols.length === 0) continue;
        if (cols.every(c => /^[-:]+$/.test(c))) { headerSeen = true; inTable = true; continue; }
        if (!headerSeen) { inTable = true; continue; }  // skip header row
        if (inTable) rows.push(cols);
      } else {
        if (inTable && line.trim() === '') continue;
        inTable = false;
        headerSeen = false;
      }
    }
    return rows;
  }

  function stripFormulaNoise(title) {
    return title
      .replace(/（[^）]*）/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/必记|必背|必考/g, '')
      .replace(/\*\*/g, '')   // 去掉 Markdown 加粗
      .replace(/\s+·\s*\d+\s*条$/, '')
      .trim();
  }

  function isGenericTitle(title) {
    return /^(核心公式|关键公式|公式|主要公式|重点公式)$/.test(title);
  }

  function extractCondition(body) {
    const m = body.match(/(其中|条件)[：:]([^\n]+)/);
    return m ? m[2].trim() : '';
  }

  function extractNote(body, title) {
    const m = body.match(/\*\*关键(?:关系|结论|公式)\*\*[：:]?([^\n]+)/);
    return m ? m[1].trim() : '';
  }

  global.Parser = Parser;
})(window);
