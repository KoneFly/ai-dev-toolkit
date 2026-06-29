/* ==============================================================
 * views/ai.js - AI 出题视图
 * 流程：选章节 + 题型 + 难度 + 数量 + 知识源 → 调 LLM 流式生成 → 单题卡操作
 * ============================================================== */

(function (global) {
  'use strict';

  const AIView = {};
  let selectedChapters = new Set();
  let selectedSources = new Set(['01_考点清单.md', '03_公式手卡.md']);
  let currentDifficulty = 'mid';
  let currentType = '计算题';
  let currentCount = 5;
  let extraHint = '';
  let currentController = null;     // 用于中止流式
  let generatedQuestions = [];      // 当次生成的题目（未保存到题库）

  const QUESTION_TYPES = ['计算题', '概念题', '选择题', '简答题', '证明题', '综合题'];

  AIView.render = function () {
    renderConfigStatus();
    renderChapterChips();
    renderSourceList();
    renderResults();
  };

  /* ============== 配置状态条 ============== */
  function renderConfigStatus() {
    const el = document.getElementById('ai-config-status');
    if (!el) return;
    const cfg = AIClient.loadConfig();
    if (AIClient.isConfigured()) {
      const preset = AIClient.PRESETS.find(p => p.id === cfg.preset);
      const name = preset ? preset.name : '自定义';
      el.className = 'ai-config-status ok';
      el.innerHTML = `<span class="dot"></span><span>已连接 · ${name} · ${cfg.model}</span><button id="ai-cfg-btn">修改</button>`;
    } else {
      el.className = 'ai-config-status warn';
      el.innerHTML = `<span class="dot"></span><span>未配置 API（点右侧按钮配置）</span><button id="ai-cfg-btn">配置</button>`;
    }
    document.getElementById('ai-cfg-btn').onclick = showConfigDialog;
  }

  /* ============== 章节多选 chip ============== */
  function renderChapterChips() {
    const wrap = document.getElementById('ai-chapter-grid');
    if (!wrap || !App.state.chapters) return;
    wrap.innerHTML = '';
    const list = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);
    list.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'ai-chapter-chip' + (selectedChapters.has(c.id) ? ' selected' : '');
      chip.textContent = `Ch${c.id} · ${c.name.replace(/^第\d+章\s*/, '')}`;
      chip.title = c.name;
      chip.onclick = () => {
        if (selectedChapters.has(c.id)) selectedChapters.delete(c.id);
        else selectedChapters.add(c.id);
        chip.classList.toggle('selected');
      };
      wrap.appendChild(chip);
    });
  }

  /* ============== 知识源勾选 ============== */
  function renderSourceList() {
    const wrap = document.getElementById('ai-source-list');
    if (!wrap) return;
    const sources = ['01_考点清单.md', '02_例题精讲.md', '03_公式手卡.md', '04_真题映射.md', '05_自测.md'];
    wrap.innerHTML = '';
    sources.forEach(s => {
      const item = document.createElement('label');
      item.className = 'ai-source-item';
      item.innerHTML = `<input type="checkbox" ${selectedSources.has(s) ? 'checked' : ''}> <span>${s}</span>`;
      const cb = item.querySelector('input');
      cb.onchange = () => {
        if (cb.checked) selectedSources.add(s);
        else selectedSources.delete(s);
      };
      wrap.appendChild(item);
    });
  }

  /* ============== 渲染结果列表 ============== */
  function renderResults() {
    const mount = document.getElementById('ai-result-list');
    if (!mount) return;

    const bank = App.state.aiQuestionBank || {};
    const bankCount = Object.values(bank).reduce((s, ch) => s + (ch.questions || []).length, 0);
    const bankCountEl = document.getElementById('ai-bank-count');
    if (bankCountEl) bankCountEl.textContent = `已收录 ${bankCount} 题`;

    if (generatedQuestions.length === 0) {
      mount.innerHTML = `<div class="ai-result-empty">
        左侧填写参数，点击「生成题目」<br>
        AI 会基于你选择的章节材料命制练习题
      </div>`;
      return;
    }

    mount.innerHTML = '';
    generatedQuestions.forEach((q, idx) => {
      mount.appendChild(buildQuestionCard(q, idx));
    });
    renderMath(mount);
  }

  function buildQuestionCard(q, idx) {
    const card = document.createElement('div');
    card.className = 'ai-question-card' + (q.__saved ? ' saved' : '') + (q.__discarded ? ' discarded' : '');
    const diffClass = `difficulty-${q.difficulty || 'mid'}`;
    const diffText = { easy: '基础', mid: '中等', hard: '高难度' }[q.difficulty || 'mid'];

    card.innerHTML = `
      <div class="ai-q-head">
        <span class="ai-q-num">Q${idx + 1}</span>
        <span class="ai-q-tag ${diffClass}">${diffText}</span>
        <span class="ai-q-tag">${q.type || '题目'}</span>
        <span style="color:var(--ink-soft);font-size:13px;">${q.title || ''}</span>
        <div class="ai-q-actions">
          ${q.__saved
            ? '<button disabled>✓ 已入库</button>'
            : '<button class="primary" data-act="save">✓ 加入题库</button>'}
          <button data-act="discard">${q.__discarded ? '已丢弃' : '✗ 丢弃'}</button>
        </div>
      </div>
      <div class="ai-q-body markdown-content"></div>
      <div class="ai-q-answer-toggle" data-idx="${idx}">▾ 显示答案 / 解析</div>
      <div class="ai-q-answer markdown-content" hidden></div>
      ${q.keypoints && q.keypoints.length ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:10px;">📌 考点：${q.keypoints.join(' · ')}</div>` : ''}
    `;

    card.querySelector('.ai-q-body').innerHTML = marked.parse(q.question || '');
    card.querySelector('.ai-q-answer').innerHTML = marked.parse(q.answer || '');

    // 答案折叠
    const toggle = card.querySelector('.ai-q-answer-toggle');
    const ansEl = card.querySelector('.ai-q-answer');
    toggle.onclick = () => {
      const isHidden = ansEl.hasAttribute('hidden');
      if (isHidden) {
        ansEl.removeAttribute('hidden');
        toggle.textContent = '▴ 收起答案';
        renderMath(ansEl);
      } else {
        ansEl.setAttribute('hidden', '');
        toggle.textContent = '▾ 显示答案 / 解析';
      }
    };

    // 加入题库 / 丢弃
    card.querySelectorAll('.ai-q-actions button').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.act;
        if (act === 'save') saveQuestionToBank(idx);
        else if (act === 'discard') discardQuestion(idx);
      };
    });

    return card;
  }

  function saveQuestionToBank(idx) {
    const q = generatedQuestions[idx];
    if (!q || q.__saved) return;

    if (!App.state.aiQuestionBank) App.state.aiQuestionBank = {};
    // 归类到第一个选中的章节
    const chId = Array.from(selectedChapters)[0] || 'misc';
    if (!App.state.aiQuestionBank[chId]) {
      App.state.aiQuestionBank[chId] = { questions: [] };
    }
    App.state.aiQuestionBank[chId].questions.push({
      id: q.id,
      title: q.title,
      question: q.question,
      answer: q.answer,
      difficulty: q.difficulty,
      type: q.type,
      keypoints: q.keypoints,
      chId,
      createdAt: q.createdAt
    });
    q.__saved = true;
    AppStorage.save(App.state);
    App.showToast('✓ 已加入题库');
    renderResults();
  }

  function discardQuestion(idx) {
    const q = generatedQuestions[idx];
    if (!q) return;
    q.__discarded = !q.__discarded;
    renderResults();
  }

  /* ============== 生成题目（分批 + 流式增量） ============== */
  const BATCH_THRESHOLD = 5; // 超过 5 题就拆批

  async function generate() {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    if (!AIClient.isConfigured()) {
      App.showToast('请先配置 AI API');
      showConfigDialog();
      return;
    }

    if (selectedChapters.size === 0) {
      App.showToast('请至少选择 1 个章节');
      return;
    }
    if (selectedSources.size === 0) {
      App.showToast('请至少勾选 1 个知识源文件');
      return;
    }

    const sources = collectSources();
    if (sources.length === 0) {
      App.showToast('所选章节中没有匹配的知识源内容');
      return;
    }

    // 切换 UI
    const btn = document.getElementById('ai-generate-btn');
    btn.textContent = '⏸ 中止';
    btn.dataset.state = 'streaming';

    // 清空当前结果，准备增量渲染
    generatedQuestions = [];
    const mount = document.getElementById('ai-result-list');
    mount.innerHTML = `<div class="ai-progress-banner" id="ai-progress-banner">
      <div class="ai-progress-text">⏳ AI 正在命题中...</div>
      <div class="ai-progress-detail" id="ai-progress-detail">已生成 0 / ${currentCount} 题</div>
    </div>
    <div id="ai-questions-stream"></div>`;

    // 计算分批策略：N>5 拆两批并行
    const batches = splitBatches(currentCount, BATCH_THRESHOLD);
    let totalDone = 0;
    let totalFailed = 0;

    const updateProgress = () => {
      const detail = document.getElementById('ai-progress-detail');
      if (detail) {
        const failed = totalFailed > 0 ? `（${totalFailed} 题解析失败）` : '';
        detail.textContent = `已生成 ${totalDone} / ${currentCount} 题${failed}`;
      }
    };

    const onQuestionReceived = (q) => {
      if (!q) {
        totalFailed++;
        updateProgress();
        return;
      }
      generatedQuestions.push(q);
      totalDone++;
      updateProgress();
      // 立即渲染这一题
      const streamMount = document.getElementById('ai-questions-stream');
      if (streamMount) {
        const card = buildQuestionCard(q, generatedQuestions.length - 1);
        streamMount.appendChild(card);
        renderMath(card);
      }
    };

    // 用一个外层 controller 聚合所有批次的中止
    const aggController = { abort: () => {} };
    currentController = aggController;
    const subControllers = [];
    aggController.abort = () => subControllers.forEach(c => c && c.abort && c.abort());

    try {
      // 并行执行所有批次
      const promises = batches.map((batchCount, batchIdx) =>
        runSingleBatch(sources, batchCount, batchIdx, onQuestionReceived, subControllers)
      );
      await Promise.allSettled(promises);

      // 完成
      const banner = document.getElementById('ai-progress-banner');
      if (banner) {
        if (totalDone > 0) {
          banner.className = 'ai-progress-banner done';
          banner.innerHTML = `<div class="ai-progress-text">✓ 完成：共生成 ${totalDone} 题${totalFailed > 0 ? `，${totalFailed} 题解析失败` : ''}</div>`;
          App.showToast(`✓ 已生成 ${totalDone} 道题`);
        } else {
          banner.className = 'ai-progress-banner error';
          banner.innerHTML = `<div class="ai-progress-text">⚠️ 未能生成任何题目，请重试或检查 API 配置</div>`;
        }
      }
      // 重渲染题库统计
      const bank = App.state.aiQuestionBank || {};
      const bankCount = Object.values(bank).reduce((s, ch) => s + (ch.questions || []).length, 0);
      const bankCountEl = document.getElementById('ai-bank-count');
      if (bankCountEl) bankCountEl.textContent = `已收录 ${bankCount} 题`;
    } finally {
      currentController = null;
      btn.textContent = '✨ 生成题目';
      btn.dataset.state = 'idle';
    }
  }

  /**
   * 把总数 N 拆成多个批次。N <= threshold 单批；N > threshold 均分两批。
   */
  function splitBatches(total, threshold) {
    if (total <= threshold) return [total];
    const half = Math.ceil(total / 2);
    return [half, total - half];
  }

  /**
   * 单批次：调用一次 streamChat + 流式 NDJSON 解析
   */
  async function runSingleBatch(sources, count, batchIdx, onQuestion, subControllers) {
    const messages = AIClient.buildQuestionPrompt({
      sources,
      questionType: currentType,
      difficulty: currentDifficulty,
      count,
      extraHint: extraHint + (batchIdx > 0 ? `\n（这是第 ${batchIdx + 1} 批，请避免与前一批重复）` : '')
    });

    const parser = AIClient.createStreamParser((q) => onQuestion(q));

    return new Promise((resolve) => {
      let aborted = false;
      AIClient.streamChat(
        messages,
        (delta, full) => {
          if (!aborted) parser.feed(delta);
        },
        (full) => {
          parser.flush();
          resolve();
        },
        (err) => {
          aborted = true;
          parser.flush();
          console.error(`批次 ${batchIdx + 1} 错误:`, err);
          // 在进度条下方加一条错误（非致命）
          const banner = document.getElementById('ai-progress-banner');
          if (banner && !banner.querySelector(`.batch-err-${batchIdx}`)) {
            const errLine = document.createElement('div');
            errLine.className = `batch-err-${batchIdx}`;
            errLine.style.cssText = 'font-size:12px;color:var(--ink-red);margin-top:4px;';
            errLine.textContent = `批次 ${batchIdx + 1} 出错：${err.message}`;
            banner.appendChild(errLine);
          }
          resolve();
        }
      ).then(ctrl => {
        if (ctrl) subControllers.push(ctrl);
      });
    });
  }

  function collectSources() {
    const sources = [];
    // selectedChapters: Set of chId（章节 id）
    // selectedSources: Set of 文件名（如 '01_考点清单.md'）
    // 但 chapter 对象里没存原始 MD，只有解析后结构。要拼回原始内容供 AI 阅读。
    for (const chId of selectedChapters) {
      const ch = App.state.chapters[chId];
      if (!ch) continue;
      for (const src of selectedSources) {
        const body = reconstructSource(ch, src);
        if (body) sources.push({ name: `${ch.name} - ${src}`, body });
      }
    }
    return sources;
  }

  /**
   * 根据章节对象和文件名重建可读文本（因为 parser 只保留解析后结构，
   * 这里把结构化数据重新序列化成 AI 易读的纯文本）
   */
  function reconstructSource(ch, fileName) {
    if (fileName === '01_考点清单.md') {
      if (!ch.keypoints || !ch.keypoints.length) return '';
      return ch.keypoints.map(kp => `## ${kp.title} (★${kp.star || 3})\n${kp.body || ''}`).join('\n\n');
    }
    if (fileName === '02_例题精讲.md') {
      if (!ch.examples || !ch.examples.length) return '';
      return ch.examples.map(e => `## ${e.title}\n${e.body}`).join('\n\n');
    }
    if (fileName === '03_公式手卡.md') {
      if (!ch.formulas || !ch.formulas.length) return '';
      return ch.formulas.map(f => {
        const lines = [`### ${f.name}`, f.formula];
        if (f.condition) lines.push(`条件：${f.condition}`);
        if (f.meaning) lines.push(`含义：${f.meaning}`);
        if (f.application) lines.push(`应用：${f.application}`);
        return lines.join('\n');
      }).join('\n\n');
    }
    if (fileName === '04_真题映射.md') {
      return ch.examMapping || '';
    }
    if (fileName === '05_自测.md') {
      if (!ch.quizQuestions || !ch.quizQuestions.length) return '';
      return ch.quizQuestions.map((q, i) => `### ${q.title || '题 ' + (i + 1)}\n${q.question}\n\n**参考答案**：\n${q.answer}`).join('\n\n');
    }
    return '';
  }

  /* ============== AI 配置弹窗 ============== */
  function showConfigDialog() {
    const cfg = AIClient.loadConfig();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>🔧 AI 出题配置</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">配置仅保存在浏览器本地（LocalStorage），不会上传到任何服务器喵～</p>

          <div class="form-row">
            <label>预设供应商</label>
            <select id="cfg-preset">
              ${AIClient.PRESETS.map(p => `<option value="${p.id}" ${cfg.preset === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
            <div class="form-hint">选择后会自动填充 Base URL 和默认模型，可随后手动修改</div>
          </div>

          <div class="form-row">
            <label>Base URL</label>
            <input type="text" id="cfg-baseurl" value="${escapeAttr(cfg.baseURL)}" placeholder="https://api.deepseek.com/v1">
            <div class="form-hint">所有 OpenAI 兼容 API 都遵循同一协议，只需替换此 URL</div>
          </div>

          <div class="form-row">
            <label>API Key</label>
            <input type="password" id="cfg-apikey" value="${escapeAttr(cfg.apiKey)}" placeholder="sk-...">
            <div class="form-hint">前往对应平台的控制台申请，免费额度通常足够期末用量</div>
          </div>

          <div class="form-row">
            <label>模型名称</label>
            <input type="text" id="cfg-model" value="${escapeAttr(cfg.model)}" placeholder="deepseek-chat">
            <div class="form-hint">不同供应商命名不同，参考其文档</div>
          </div>

          <div class="form-row">
            <label>温度 (创造性)</label>
            <input type="text" id="cfg-temp" value="${cfg.temperature ?? 0.7}" placeholder="0.7">
            <div class="form-hint">范围 0-2，越高越发散。出题建议 0.6-0.9</div>
          </div>

          <div class="protocol-help">
            <strong>📌 推荐方案（按性价比）</strong><br>
            • <strong>DeepSeek</strong>：国内最便宜，1M tokens ~0.5 元，命题能力强<br>
            • <strong>智谱 GLM-4-Flash</strong>：免费额度大，速度快<br>
            • <strong>通义千问</strong>：阿里出品，对中文教材理解好<br>
            • <strong>硅基流动</strong>：聚合多家开源模型，按量计费
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-cancel">取消</button>
          <button class="primary modal-save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 预设切换 → 自动填 baseURL/model
    overlay.querySelector('#cfg-preset').onchange = (e) => {
      const preset = AIClient.PRESETS.find(p => p.id === e.target.value);
      if (preset) {
        overlay.querySelector('#cfg-baseurl').value = preset.baseURL;
        overlay.querySelector('#cfg-model').value = preset.model;
      }
    };

    const close = () => document.body.removeChild(overlay);
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.modal-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelector('.modal-save').onclick = () => {
      const newCfg = {
        preset: overlay.querySelector('#cfg-preset').value,
        baseURL: overlay.querySelector('#cfg-baseurl').value.trim(),
        apiKey: overlay.querySelector('#cfg-apikey').value.trim(),
        model: overlay.querySelector('#cfg-model').value.trim(),
        temperature: parseFloat(overlay.querySelector('#cfg-temp').value) || 0.7,
        maxTokens: cfg.maxTokens || 4000
      };
      if (!newCfg.apiKey || !newCfg.baseURL || !newCfg.model) {
        alert('请填写完整的 Base URL / API Key / Model');
        return;
      }
      AIClient.saveConfig(newCfg);
      close();
      App.showToast('✓ AI 配置已保存');
      renderConfigStatus();
    };
  }

  AIView.showConfigDialog = showConfigDialog;

  /* ============== 错题 AI 解析（暴露给 dashboard） ============== */
  AIView.explainMistake = async function (chId, qIdx) {
    const ch = App.state.chapters[chId];
    if (!ch) return;
    const q = ch.quizQuestions[qIdx];
    if (!q) return;

    if (!AIClient.isConfigured()) {
      App.showToast('请先配置 AI API');
      showConfigDialog();
      return;
    }

    // 创建讲解弹窗
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" style="width:680px;">
        <div class="modal-header">
          <h3>🤖 AI 讲解</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div style="background:rgba(180,130,60,0.06);border-left:3px solid var(--ink-red);padding:10px 14px;border-radius:4px;margin-bottom:14px;font-size:14px;">
            <strong>${ch.name}</strong> · ${q.title || ''}<br>
            <div style="margin-top:6px;color:var(--ink-soft);">${escapeHtml(q.question || '').slice(0, 200)}...</div>
          </div>
          <div id="ai-explain-content" style="font-size:14px;line-height:1.8;min-height:120px;">⏳ AI 正在思考...</div>
        </div>
        <div class="modal-footer">
          <button class="modal-cancel">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const contentEl = overlay.querySelector('#ai-explain-content');

    const close = () => document.body.removeChild(overlay);
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.modal-cancel').onclick = close;

    let fullText = '';
    await AIClient.streamChat(
      AIClient.buildExplainPrompt(q.question, q.answer),
      (delta, full) => {
        fullText = full;
        contentEl.innerHTML = marked.parse(full) + '<span style="color:var(--ink-red);">▋</span>';
      },
      (full) => {
        contentEl.innerHTML = marked.parse(full);
        renderMath(contentEl);
      },
      (err) => {
        contentEl.innerHTML = `<div style="color:var(--ink-red);">⚠️ ${err.message}</div>`;
      }
    );
  };

  /* ============== 工具 ============== */
  function renderMath(el) {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false,
          strict: 'ignore'
        });
      } catch (e) {}
    }
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ============== 绑定 ============== */
  AIView.bind = function () {
    // 题型 select
    const typeSel = document.getElementById('ai-type');
    if (typeSel) {
      typeSel.innerHTML = QUESTION_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
      typeSel.value = currentType;
      typeSel.onchange = e => { currentType = e.target.value; };
    }

    // 难度 segmented
    document.querySelectorAll('.ai-difficulty button').forEach(btn => {
      btn.onclick = () => {
        currentDifficulty = btn.dataset.diff;
        document.querySelectorAll('.ai-difficulty button').forEach(b => b.classList.toggle('active', b === btn));
      };
    });

    // 数量
    const cntInput = document.getElementById('ai-count');
    if (cntInput) {
      cntInput.value = currentCount;
      cntInput.onchange = e => {
        const n = parseInt(e.target.value);
        currentCount = (n >= 1 && n <= 20) ? n : 5;
        e.target.value = currentCount;
      };
    }

    // 额外提示
    const hintInput = document.getElementById('ai-extra');
    if (hintInput) {
      hintInput.onchange = e => { extraHint = e.target.value.trim(); };
    }

    // 全选/全清章节
    const selAll = document.getElementById('ai-ch-all');
    const clrAll = document.getElementById('ai-ch-clear');
    if (selAll) selAll.onclick = () => {
      selectedChapters = new Set(Object.keys(App.state.chapters || {}));
      renderChapterChips();
    };
    if (clrAll) clrAll.onclick = () => {
      selectedChapters.clear();
      renderChapterChips();
    };

    // 生成按钮
    const genBtn = document.getElementById('ai-generate-btn');
    if (genBtn) genBtn.onclick = () => {
      if (genBtn.dataset.state === 'streaming') {
        if (currentController) currentController.abort();
        currentController = null;
        genBtn.dataset.state = 'idle';
        genBtn.textContent = '✨ 生成题目';
        App.showToast('已中止');
      } else {
        generate();
      }
    };

    // 题库导出按钮
    const exportBtn = document.getElementById('ai-bank-export');
    if (exportBtn) exportBtn.onclick = exportBank;

    // 题库清空按钮
    const clearBtn = document.getElementById('ai-bank-clear');
    if (clearBtn) clearBtn.onclick = () => {
      if (confirm('确认清空已收录的 AI 题库？此操作不可撤销。')) {
        App.state.aiQuestionBank = {};
        AppStorage.save(App.state);
        App.showToast('题库已清空');
        renderResults();
      }
    };
  };

  /* ============== 导出题库为 markdown ============== */
  function exportBank() {
    const bank = App.state.aiQuestionBank || {};
    let md = `# AI 生成题库\n\n生成时间：${new Date().toLocaleString()}\n\n`;
    for (const chId in bank) {
      const ch = App.state.chapters[chId];
      const chName = ch ? ch.name : `章节 ${chId}`;
      md += `## ${chName}\n\n`;
      (bank[chId].questions || []).forEach((q, i) => {
        md += `### ${i + 1}. ${q.title || 'AI 题'}\n\n`;
        md += `**难度**：${q.difficulty || 'mid'} · **类型**：${q.type || '-'}\n\n`;
        md += `${q.question}\n\n`;
        md += `> [!faq]- 答案\n> ${(q.answer || '').replace(/\n/g, '\n> ')}\n\n`;
        if (q.keypoints && q.keypoints.length) {
          md += `📌 考点：${q.keypoints.join(' · ')}\n\n`;
        }
        md += '---\n\n';
      });
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AI题库_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    App.showToast('已导出 Markdown');
  }

  global.AIView = AIView;
})(window);
