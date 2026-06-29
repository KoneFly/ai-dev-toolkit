/* ==============================================================
 * ai-client.js - OpenAI 兼容协议客户端（浏览器直连，流式）
 *
 * 支持平台（只需切换 baseURL）：
 *   - OpenAI 官方     : https://api.openai.com/v1
 *   - DeepSeek       : https://api.deepseek.com/v1
 *   - 月之暗面 Kimi   : https://api.moonshot.cn/v1
 *   - 智谱 GLM       : https://open.bigmodel.cn/api/paas/v4
 *   - 通义千问 DashScope : https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - 硅基流动 SiliconCloud : https://api.siliconflow.cn/v1
 *   - Anthropic Claude（通过兼容代理）
 *   - 任何自部署 OpenAI 兼容服务（如 Ollama、vLLM 等）
 *
 * 安全性：API Key 仅存于浏览器 LocalStorage，所有请求由浏览器直接发起
 *        不经任何中间服务器。代价是 CORS——主流国产 API 都已开放 CORS。
 * ============================================================== */

(function (global) {
  'use strict';

  const AIClient = {};
  const CFG_KEY = 'exam-cram-review.ai-config.v1';

  /* ============== 预设供应商 ============== */
  AIClient.PRESETS = [
    { id: 'deepseek', name: 'DeepSeek',          baseURL: 'https://api.deepseek.com/v1',           model: 'deepseek-chat' },
    { id: 'kimi',     name: '月之暗面 Kimi',     baseURL: 'https://api.moonshot.cn/v1',            model: 'moonshot-v1-32k' },
    { id: 'glm',      name: '智谱 GLM',          baseURL: 'https://open.bigmodel.cn/api/paas/v4',  model: 'glm-4-flash' },
    { id: 'qwen',     name: '通义千问',          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    { id: 'silicon',  name: '硅基流动',          baseURL: 'https://api.siliconflow.cn/v1',         model: 'Qwen/Qwen2.5-7B-Instruct' },
    { id: 'openai',   name: 'OpenAI 官方',       baseURL: 'https://api.openai.com/v1',             model: 'gpt-4o-mini' },
    { id: 'custom',   name: '自定义 (Ollama 等)',baseURL: 'http://localhost:11434/v1',             model: 'llama3.1' }
  ];

  /* ============== 配置读写 ============== */
  AIClient.loadConfig = function () {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (!raw) return defaultConfig();
      return Object.assign(defaultConfig(), JSON.parse(raw));
    } catch (e) {
      return defaultConfig();
    }
  };

  AIClient.saveConfig = function (cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  };

  AIClient.isConfigured = function () {
    const c = AIClient.loadConfig();
    return !!(c.apiKey && c.baseURL && c.model);
  };

  function defaultConfig() {
    return {
      preset: 'deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 8000
    };
  }

  /* ============== 流式聊天调用 ============== */
  /**
   * 流式调用 chat completions
   * @param {Array} messages - [{role, content}]
   * @param {Function} onDelta - 每收到一段 delta 文本调用
   * @param {Function} onDone - 完成时调用，参数为完整文本
   * @param {Function} onError - 出错时调用
   * @returns {AbortController} 可用于中止请求
   */
  AIClient.streamChat = async function (messages, onDelta, onDone, onError) {
    const cfg = AIClient.loadConfig();
    if (!cfg.apiKey || !cfg.baseURL || !cfg.model) {
      onError(new Error('AI 配置未完成，请先配置 API Key / Base URL / Model'));
      return null;
    }

    const controller = new AbortController();
    let fullText = '';

    try {
      const url = cfg.baseURL.replace(/\/$/, '') + '/chat/completions';
      const resp = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          stream: true,
          temperature: cfg.temperature ?? 0.7,
          max_tokens: cfg.maxTokens ?? 4000
        })
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`API ${resp.status}: ${errBody.slice(0, 300)}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 格式：data: {...}\n\n
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const delta = obj.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onDelta(delta, fullText);
            }
          } catch (e) {
            // 忽略解析错误（可能是 keep-alive 心跳）
          }
        }
      }

      onDone(fullText);
    } catch (e) {
      if (e.name === 'AbortError') {
        onError(new Error('用户已中止请求'));
      } else {
        onError(e);
      }
    }
    return controller;
  };

  /* ============== Prompt 构建：根据章节材料出题 ============== */
  /**
   * @param {Object} opts
   * @param {Array<{name, body}>} opts.sources - 知识源材料
   * @param {string} opts.questionType - 题型："计算题" | "概念题" | "选择题" | "证明题" | "综合题"
   * @param {string} opts.difficulty - 难度："easy" | "mid" | "hard"
   * @param {number} opts.count - 题目数量
   * @param {string} opts.extraHint - 额外要求（用户输入）
   */
  AIClient.buildQuestionPrompt = function (opts) {
    const diffText = { easy: '基础', mid: '中等', hard: '高难度（考研/期末压轴级别）' }[opts.difficulty] || '中等';

    // 截断每份材料，避免 token 爆炸
    const MAX_PER_SOURCE = 3000;
    const sourceText = opts.sources.map(s => {
      const body = s.body.length > MAX_PER_SOURCE
        ? s.body.slice(0, MAX_PER_SOURCE) + '\n...(已截断)'
        : s.body;
      return `### 知识源 [${s.name}]\n${body}`;
    }).join('\n\n');

    const system = `你是一位资深大学课程命题教师，擅长根据教材和考点材料命制高质量的练习题。
你必须严格基于用户提供的知识源进行命题，禁止自行虚构超纲内容。
所有数学/物理/电路公式必须使用 KaTeX 兼容的 LaTeX 语法：行内 $...$，块级 $$...$$。
答案要给出完整解题步骤，体现学生应该掌握的思维过程。`;

    const user = `请根据以下知识源材料，命制 **${opts.count}** 道 **${opts.questionType}**，难度为 **${diffText}**。

${opts.extraHint ? `### 额外要求\n${opts.extraHint}\n\n` : ''}${sourceText}

### 输出格式（严格遵守，否则前端无法解析）

每道题输出为**一个独立的 JSON 对象**，前后用分隔符包裹。**禁止** 用 \`\`\`json 代码块，**禁止** 输出 JSON 数组，**禁止** 在分隔符外写任何额外内容。

格式如下（必须逐字使用这两个分隔符）：

<<<QSTART>>>
{"title":"题目1的小标题（不超过20字）","difficulty":"${opts.difficulty}","type":"${opts.questionType}","question":"题目正文，含必要数据和已知条件，公式用 $...$ 包裹","answer":"详细解答步骤，可以用 \\n 换行，公式用 $...$ 或 $$...$$","keypoints":["考点1","考点2"]}
<<<QEND>>>

<<<QSTART>>>
{"title":"题目2...","difficulty":"...","type":"...","question":"...","answer":"...","keypoints":[]}
<<<QEND>>>

... 共 ${opts.count} 个 <<<QSTART>>>...<<<QEND>>> 块。

JSON 规则：
- 所有字符串内的换行用 \\n 转义
- LaTeX 反斜杠用双反斜杠（如 \\\\frac、\\\\sigma）
- 每个块内的 JSON 必须单行，禁止换行
- 严禁在块外输出任何前言/解释/markdown`;

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  };

  /**
   * Prompt：让 AI 讲解一道错题
   */
  AIClient.buildExplainPrompt = function (question, answer) {
    const system = `你是一位耐心细致的大学课程辅导老师。学生在某道题上做错了，请用通俗清晰的语言为他讲解。
重点指出：(1) 题目的考点是什么，(2) 易错点在哪，(3) 正确的解题思路与步骤。
所有公式用 KaTeX 兼容的 LaTeX。回答用 Markdown 格式。`;
    const user = `### 题目\n${question}\n\n### 参考答案\n${answer || '（无参考答案，请你直接给出正确解法）'}\n\n请讲解这道题。`;
    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  };

  /* ============== 解析单条 NDJSON 题目（强容错） ============== */
  function parseSingleQuestion(rawBlock, idx) {
    if (!rawBlock || !rawBlock.trim()) return null;

    // 1. 剥离可能残留的 ```json / ``` 代码块包裹
    let s = rawBlock.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    // 2. 取出第一对 {} 之间的内容（防止前后污染）
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    s = s.slice(firstBrace, lastBrace + 1);

    // 3. 尝试解析
    try {
      const q = JSON.parse(s);
      return normalizeQuestion(q, idx);
    } catch (e) {
      // 兜底：尝试修复尾部未闭合的字符串/引号
      try {
        const fixed = s.replace(/,\s*}$/, '}').replace(/,\s*]$/, ']');
        const q = JSON.parse(fixed);
        return normalizeQuestion(q, idx);
      } catch (e2) {
        console.warn(`第 ${idx + 1} 题解析失败:`, e.message, '原始:', s.slice(0, 200));
        return null;
      }
    }
  }

  function normalizeQuestion(q, idx) {
    return {
      id: 'ai-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 6),
      title: q.title || `AI 题 ${idx + 1}`,
      difficulty: q.difficulty || 'mid',
      type: q.type || '题目',
      question: q.question || '',
      answer: q.answer || '',
      keypoints: Array.isArray(q.keypoints) ? q.keypoints : [],
      createdAt: Date.now()
    };
  }

  /* ============== 流式增量解析（NDJSON 协议） ==============
   * 在 streamChat 的 onDelta 回调中实时调用：发现一个完整
   * <<<QSTART>>>...<<<QEND>>> 块就触发 onQuestion(question)
   * 返回的 createParser 维护状态，处理流式拼接
   */
  AIClient.createStreamParser = function (onQuestion) {
    let buffer = '';
    let questionIdx = 0;

    return {
      feed(deltaText) {
        buffer += deltaText;
        // 循环消费所有已完整的块
        while (true) {
          const startIdx = buffer.indexOf('<<<QSTART>>>');
          if (startIdx === -1) {
            // 无开始标记：保留尾部 16 字符防止跨 chunk 切断 "<<<QSTAR" 等
            if (buffer.length > 32) buffer = buffer.slice(-32);
            break;
          }
          const endIdx = buffer.indexOf('<<<QEND>>>', startIdx + 12);
          if (endIdx === -1) break; // 当前块还没收完

          const rawBlock = buffer.slice(startIdx + 12, endIdx);
          buffer = buffer.slice(endIdx + 10);

          const q = parseSingleQuestion(rawBlock, questionIdx);
          if (q) {
            onQuestion(q, questionIdx);
            questionIdx++;
          } else {
            // 解析失败，让上层知道（idx 不递增）
            onQuestion(null, questionIdx);
          }
        }
      },
      flush() {
        // 流结束：处理可能未闭合的最后一块（兜底）
        const startIdx = buffer.indexOf('<<<QSTART>>>');
        if (startIdx !== -1) {
          // 没有 QEND 但有 QSTART：尝试解析残块（找最后一个 } 截断）
          const rawBlock = buffer.slice(startIdx + 12);
          const lastBrace = rawBlock.lastIndexOf('}');
          if (lastBrace !== -1) {
            const q = parseSingleQuestion(rawBlock.slice(0, lastBrace + 1), questionIdx);
            if (q) {
              onQuestion(q, questionIdx);
              questionIdx++;
            }
          }
        }
        buffer = '';
        return questionIdx;
      },
      get count() { return questionIdx; }
    };
  };

  /* ============== 兼容旧 API：从完整文本批量解析 ============== */
  AIClient.parseQuestionsFromOutput = function (text) {
    const questions = [];
    const parser = AIClient.createStreamParser((q) => {
      if (q) questions.push(q);
    });
    parser.feed(text);
    parser.flush();
    if (questions.length === 0) {
      // 兜底：尝试旧的 JSON 数组协议
      try {
        const blockMatch = text.match(/```json\s*([\s\S]*?)```/);
        const jsonStr = blockMatch ? blockMatch[1].trim() : text.trim();
        const arr = JSON.parse(jsonStr);
        if (Array.isArray(arr)) {
          return arr.map((q, i) => normalizeQuestion(q, i));
        }
      } catch (e) {
        // 完全失败
      }
      throw new Error('未能从输出中解析出任何题目（既不是 NDJSON 也不是 JSON 数组）');
    }
    return questions;
  };

  global.AIClient = AIClient;
})(window);
