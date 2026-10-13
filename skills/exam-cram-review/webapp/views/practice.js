/* ==============================================================
 * views/practice.js - 练习视图协调器（自测 + AI 出题融合）
 * 复用 QuizView 核心逻辑，新增 AI 出题面板 + AI 题模式
 * ============================================================== */

(function (global) {
  'use strict';

  const PracticeView = {};
  let currentGeneration = null;
  const QUESTION_TYPES = ['计算题', '概念题', '选择题', '简答题', '证明题', '综合题'];

  PracticeView.render = function (chId, qIdx) {
    if (global.QuizView) QuizView.render(chId, qIdx);
    renderAIStatus();
    updateAIBadge();
  };

  function renderAIStatus() {
    const el = document.getElementById('quiz-ai-status');
    if (!el || !global.AIClient) return;
    if (AIClient.isConfigured()) {
      const cfg = AIClient.loadConfig();
      const preset = AIClient.PRESETS.find(p => p.id === cfg.preset);
      el.className = 'quiz-ai-status ok';
      el.innerHTML = `<span class="dot"></span> ${preset ? preset.name : '自定义'} · ${cfg.model}`;
    } else {
      el.className = 'quiz-ai-status warn';
      el.innerHTML = `<span class="dot"></span> 未配置 AI — <a href="#" id="quiz-ai-cfg-link">点此配置</a>`;
      const link = document.getElementById('quiz-ai-cfg-link');
      if (link) link.onclick = (e) => { e.preventDefault(); AIView.showConfigDialog(); };
    }
  }

  function updateAIBadge() {
    const btn = document.getElementById('quiz-mode-ai');
    if (!btn) return;
    const bank = App.state.aiQuestionBank || {};
    const total = Object.values(bank).reduce((s, ch) => s + (ch.questions || []).length, 0);
    btn.textContent = `✨ AI 题${total > 0 ? ` (${total})` : ''}`;
  }

  /* ============== AI 出题面板逻辑 ============== */
  async function runAIGeneration() {
    if (currentGeneration) {
      currentGeneration.abort();
      currentGeneration = null;
      const runBtn = document.getElementById('quiz-ai-run');
      runBtn.textContent = '生成并加入练习';
      document.getElementById('quiz-ai-progress').textContent = '已停止生成，已加入题库的题目保留。';
      updateAIBadge();
      App.showToast('已停止生成');
      return;
    }
    if (!global.AIClient || !AIClient.isConfigured()) {
      App.showToast('请先配置 AI API');
      if (global.AIView) AIView.showConfigDialog();
      return;
    }

    const chId = QuizView.getCurrentChId ? QuizView.getCurrentChId() : null;
    if (!chId) {
      App.showToast('请先从左侧选择一个章节');
      return;
    }

    const ch = App.state.chapters[chId];
    if (!ch) return;

    const typeSel = document.getElementById('quiz-ai-type');
    const diffSel = document.getElementById('quiz-ai-diff');
    const countInput = document.getElementById('quiz-ai-count');
    const extraInput = document.getElementById('quiz-ai-extra');
    const runBtn = document.getElementById('quiz-ai-run');
    const progressEl = document.getElementById('quiz-ai-progress');

    const questionType = typeSel ? typeSel.value : '计算题';
    const difficulty = diffSel ? diffSel.value : 'mid';
    const count = Math.min(10, Math.max(1, parseInt(countInput?.value) || 3));
    const extra = extraInput ? extraInput.value.trim() : '';

    // 收集当前章节的知识源
    const sources = [];
    const srcKeys = ['keypoints', 'examples', 'formulas', 'examMapping', 'quizQuestions'];
    for (const key of srcKeys) {
      const body = reconstructSourceFromKey(ch, key);
      if (body) sources.push({ name: `${ch.name} - ${key}`, body });
    }

    if (sources.length === 0) {
      App.showToast('当前章节无可用知识源');
      return;
    }

    const controller = new AbortController();
    currentGeneration = controller;
    const isActive = () => currentGeneration === controller && !controller.signal.aborted;
    runBtn.textContent = '⏸ 停止生成';
    progressEl.innerHTML = '<div style="color:var(--ink-soft);">⏳ AI 正在命题...</div>';

    const messages = AIClient.buildQuestionPrompt({ sources, questionType: questionType, difficulty, count, extraHint: extra });

    let generated = 0;
    const parser = AIClient.createStreamParser((q) => {
      if (!q || !isActive()) return;
      generated++;
      progressEl.innerHTML = `<div style="color:var(--ink-soft);">已生成 ${generated} / ${count} 题</div>`;

      // 直接写入 aiQuestionBank
      if (!App.state.aiQuestionBank) App.state.aiQuestionBank = {};
      if (!App.state.aiQuestionBank[chId]) App.state.aiQuestionBank[chId] = { questions: [] };
      App.state.aiQuestionBank[chId].questions.push({
        id: q.id, title: q.title, question: q.question, answer: q.answer,
        difficulty: q.difficulty, type: q.type, keypoints: q.keypoints,
        chId, createdAt: q.createdAt
      });
      AppStorage.save(App.state);
    });

    try {
      await AIClient.streamChat(
        messages,
        (delta) => { if (isActive()) parser.feed(delta); },
        () => {
          if (!isActive()) return;
          parser.flush();
          if (generated > 0) {
            progressEl.innerHTML = `<div style="color:var(--ink-green);">✓ 已生成 ${generated} 题并加入 AI 题库</div>`;
            App.showToast(`✓ ${generated} 道 AI 题已加入练习`);
            updateAIBadge();
            // 如果当前在 AI 题模式，刷新题目列表
            if (QuizView.getMode && QuizView.getMode() === 'ai') {
              QuizView.render(chId);
            }
          } else {
            progressEl.innerHTML = `<div style="color:var(--ink-red);">⚠️ 未能生成任何题目</div>`;
          }
        },
        (err) => {
          if (!isActive() || err.name === 'AbortError') return;
          parser.flush();
          progressEl.textContent = `⚠️ ${err.message}`;
        },
        controller
      );
    } finally {
      // 取消后可以立即重试，旧请求的收尾不能重置新请求的按钮。
      if (currentGeneration === controller) {
        currentGeneration = null;
        runBtn.textContent = '生成并加入练习';
      }
    }
  }

  function reconstructSourceFromKey(ch, key) {
    if (key === 'keypoints') {
      if (!ch.keypoints || !ch.keypoints.length) return '';
      return ch.keypoints.map(kp => `## ${kp.title} (★${kp.star || 3})\n${kp.body || ''}`).join('\n\n');
    }
    if (key === 'examples') {
      if (!ch.examples || !ch.examples.length) return '';
      return ch.examples.map(e => `## ${e.title}\n${e.body}`).join('\n\n');
    }
    if (key === 'formulas') {
      if (!ch.formulas || !ch.formulas.length) return '';
      return ch.formulas.map(f => {
        const lines = [`### ${f.name}`, f.formula];
        if (f.condition) lines.push(`条件：${f.condition}`);
        return lines.join('\n');
      }).join('\n\n');
    }
    if (key === 'examMapping') return ch.examMapping || '';
    if (key === 'quizQuestions') {
      if (!ch.quizQuestions || !ch.quizQuestions.length) return '';
      return ch.quizQuestions.map((q, i) => `### ${q.title || '题' + (i+1)}\n${q.question}`).join('\n\n');
    }
    return '';
  }

  /* ============== 绑定 ============== */
  PracticeView.bind = function () {
    // AI 出题面板展开/折叠
    const aiGenBtn = document.getElementById('quiz-ai-gen');
    const aiPanel = document.getElementById('quiz-ai-panel');
    if (aiGenBtn && aiPanel) {
      aiGenBtn.onclick = () => {
        aiPanel.hidden = !aiPanel.hidden;
        aiGenBtn.classList.toggle('active', !aiPanel.hidden);
        if (!aiPanel.hidden) renderAIStatus();
      };
    }

    // AI 题型 select 填充
    const typeSel = document.getElementById('quiz-ai-type');
    if (typeSel) {
      typeSel.innerHTML = QUESTION_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    // AI 执行按钮
    const runBtn = document.getElementById('quiz-ai-run');
    if (runBtn) runBtn.onclick = runAIGeneration;
  };

  global.PracticeView = PracticeView;
})(window);
