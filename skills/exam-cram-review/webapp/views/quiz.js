/* ==============================================================
 * views/quiz.js - 自测模式（一题一屏 + 折叠答案 + 自评）
 * ============================================================== */

(function (global) {
  'use strict';

  const QuizView = {};
  let currentChId = null;
  let currentIdx = 0;
  let order = [];               // 当前题序（可被打乱）
  let shuffled = false;
  let mode = 'quiz';            // 'quiz' = 05_自测题, 'example' = 02_例题练习

  QuizView.render = function (chId, qIdx) {
    renderSidebar();
    if (chId) {
      selectChapter(chId, qIdx || 0);
    } else if (currentChId) {
      renderQuestion();
    } else {
      // 默认选第一个有题目的章节
      const list = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);
      const first = list.find(c => getItems(c).length > 0);
      if (first) selectChapter(first.id, 0);
    }
  };

  function getItems(chapter) {
    if (mode === 'quiz') return chapter.quizQuestions;
    return chapter.examples.map(ex => ({
      title: ex.title,
      question: extractQuestionFromExample(ex.body),
      answer: ex.body,
      isExample: true
    }));
  }

  function extractQuestionFromExample(body) {
    // 例题 body 形式：题干 + 解答。提取"原题/典型题型"或第一个 blockquote 作为题目
    const titleMatch = body.match(/\*\*典型题型\*\*[：:]?\s*[\r\n]+>?\s*([\s\S]*?)(?=\n\n|\*\*解|\n##)/);
    if (titleMatch) return titleMatch[1].trim().replace(/^>\s?/gm, '');
    const quoteMatch = body.match(/^>\s+([\s\S]*?)(?=\n\n|\n\*\*|\n##)/m);
    if (quoteMatch) return quoteMatch[1].trim().replace(/^>\s?/gm, '');
    // fallback: 取前 300 字符
    return body.slice(0, 300) + (body.length > 300 ? '...\n\n*（完整内容见答案）*' : '');
  }

  function renderSidebar() {
    const mount = document.getElementById('quiz-chapter-list');
    mount.innerHTML = '';
    const list = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);
    for (const c of list) {
      const items = getItems(c);
      if (items.length === 0) continue;
      const li = document.createElement('li');
      const m = AppStorage.computeMastery(App.state, c);
      li.innerHTML = `
        <span>${c.name}</span>
        <span class="count">${items.length}</span>
      `;
      li.dataset.chId = c.id;
      if (c.id === currentChId) li.classList.add('active');
      li.onclick = () => selectChapter(c.id, 0);
      mount.appendChild(li);
    }
  }

  function selectChapter(chId, qIdx) {
    currentChId = chId;
    currentIdx = qIdx || 0;
    const ch = App.state.chapters[chId];
    if (!ch) return;
    const items = getItems(ch);
    order = items.map((_, i) => i);
    if (shuffled) order = shuffle(order);
    renderSidebar();
    renderQuestion();
  }

  function renderQuestion() {
    const ch = App.state.chapters[currentChId];
    const items = ch ? getItems(ch) : [];
    if (!ch || items.length === 0) {
      document.getElementById('quiz-question').textContent =
        mode === 'example' ? '本章无例题' : '本章无自测题';
      return;
    }
    const realIdx = order[currentIdx];
    const q = items[realIdx];

    document.getElementById('quiz-counter').textContent = `${currentIdx + 1} / ${items.length}`;
    document.getElementById('quiz-chapter-tag').textContent = `${ch.name} · ${q.title}`;

    const qEl = document.getElementById('quiz-question');
    qEl.innerHTML = marked.parse(q.question || '（题目缺失）');
    renderMath(qEl);

    const ansEl = document.getElementById('quiz-answer');
    ansEl.innerHTML = marked.parse(q.answer || '');
    ansEl.hidden = true;

    document.getElementById('quiz-judge').hidden = true;
    const revealBtn = document.getElementById('quiz-reveal');
    revealBtn.disabled = false;
    revealBtn.textContent = q.isExample ? '查看完整解析' : '显示答案';

    // 已判分则标记（自测和例题分开存）
    const masteryKey = mode === 'example' ? `e-${realIdx}` : `q-${realIdx}`;
    const prevJudge = (App.state.mastery[currentChId] || {})[masteryKey];
    if (prevJudge) {
      document.getElementById('quiz-chapter-tag').innerHTML +=
        prevJudge === 'right' ? '  <span style="color:var(--green)">✓ 上次答对</span>'
                              : '  <span style="color:var(--red)">✗ 上次答错</span>';
    }
  }

  function reveal() {
    document.getElementById('quiz-answer').hidden = false;
    document.getElementById('quiz-judge').hidden = false;
    document.getElementById('quiz-reveal').disabled = true;
    renderMath(document.getElementById('quiz-answer'));

    // 在 judge 区域注入 AI 讲解按钮（如果尚未存在）
    const judgeEl = document.getElementById('quiz-judge');
    if (!judgeEl.querySelector('[data-act="ai-explain"]')) {
      const aiBtn = document.createElement('button');
      aiBtn.dataset.act = 'ai-explain';
      aiBtn.className = 'judge-btn';
      aiBtn.style.marginLeft = 'auto';
      aiBtn.style.color = 'var(--ink-blue)';
      aiBtn.style.borderColor = 'var(--ink-blue)';
      aiBtn.innerHTML = '🤖 让 AI 讲解';
      aiBtn.onclick = () => {
        if (window.AIView && AIView.explainMistake) {
          const realIdx = order[currentIdx];
          AIView.explainMistake(currentChId, realIdx);
        }
      };
      judgeEl.appendChild(aiBtn);
    }
  }

  function judge(verdict) {
    const ch = App.state.chapters[currentChId];
    const items = getItems(ch);
    const realIdx = order[currentIdx];
    const q = items[realIdx];
    const masteryKey = mode === 'example' ? `e-${realIdx}` : `q-${realIdx}`;
    if (!App.state.mastery[currentChId]) App.state.mastery[currentChId] = {};
    App.state.mastery[currentChId][masteryKey] = verdict;
    if (verdict === 'wrong') {
      App.state.mistakes.unshift({
        chId: currentChId, qIdx: realIdx, key: masteryKey,
        title: q.title, ts: Date.now(), mode
      });
      const seen = new Set();
      App.state.mistakes = App.state.mistakes.filter(m => {
        const k = `${m.chId}-${m.key || ('q-' + m.qIdx)}`;
        if (seen.has(k)) return false; seen.add(k); return true;
      }).slice(0, 100);
    } else {
      App.state.mistakes = App.state.mistakes.filter(m =>
        !(m.chId === currentChId && (m.key || `q-${m.qIdx}`) === masteryKey)
      );
    }
    App.persist();
    App.showToast(verdict === 'right' ? '✓ 已记录' : '✗ 已加入错题');
    setTimeout(() => navigate(1), 350);
  }

  function navigate(delta) {
    const ch = App.state.chapters[currentChId];
    if (!ch) return;
    const items = getItems(ch);
    currentIdx = (currentIdx + delta + items.length) % items.length;
    renderQuestion();
  }

  function toggleShuffle() {
    shuffled = !shuffled;
    document.getElementById('quiz-shuffle').classList.toggle('active', shuffled);
    const ch = App.state.chapters[currentChId];
    if (ch) {
      const items = getItems(ch);
      order = items.map((_, i) => i);
      if (shuffled) order = shuffle(order);
      currentIdx = 0;
      renderQuestion();
    }
  }

  function switchMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    document.getElementById('quiz-mode-quiz').classList.toggle('active', mode === 'quiz');
    document.getElementById('quiz-mode-example').classList.toggle('active', mode === 'example');
    // 重新选择当前章节，用新模式渲染
    const ch = App.state.chapters[currentChId];
    if (ch) {
      currentIdx = 0;
      const items = getItems(ch);
      order = items.map((_, i) => i);
      if (shuffled) order = shuffle(order);
      renderSidebar();
      renderQuestion();
    } else {
      QuizView.render();
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderMath(el) {
    if (window.renderMathInElement) {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false,
        strict: 'ignore'
      });
    }
  }

  /* ============== 绑定 ============== */
  QuizView.bind = function () {
    document.getElementById('quiz-reveal').onclick = reveal;
    document.getElementById('quiz-prev').onclick = () => navigate(-1);
    document.getElementById('quiz-next').onclick = () => navigate(1);
    document.getElementById('quiz-shuffle').onclick = toggleShuffle;
    document.getElementById('quiz-mode-quiz').onclick = () => switchMode('quiz');
    document.getElementById('quiz-mode-example').onclick = () => switchMode('example');
    document.querySelectorAll('#quiz-judge button').forEach(btn => {
      btn.onclick = () => judge(btn.dataset.judge);
    });
    // 键盘快捷键
    document.addEventListener('keydown', e => {
      if (document.getElementById('view-quiz').classList.contains('active')) {
        if (e.key === ' ') { e.preventDefault(); reveal(); }
        else if (e.key === 'ArrowRight' || e.key === 'd') navigate(1);
        else if (e.key === 'ArrowLeft' || e.key === 'a') navigate(-1);
        else if (e.key === 'j') judge('right');
        else if (e.key === 'k') judge('wrong');
      }
    });
  };

  global.QuizView = QuizView;
})(window);
