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

  QuizView.render = function (chId, qIdx) {
    renderSidebar();
    if (chId) {
      selectChapter(chId, qIdx || 0);
    } else if (currentChId) {
      renderQuestion();
    } else {
      // 默认选第一个有题目的章节
      const list = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);
      const first = list.find(c => c.quizQuestions.length > 0);
      if (first) selectChapter(first.id, 0);
    }
  };

  function renderSidebar() {
    const mount = document.getElementById('quiz-chapter-list');
    mount.innerHTML = '';
    const list = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);
    for (const c of list) {
      if (c.quizQuestions.length === 0) continue;
      const li = document.createElement('li');
      const m = AppStorage.computeMastery(App.state, c);
      li.innerHTML = `
        <span>${c.name}</span>
        <span class="count">${c.quizQuestions.length}</span>
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
    order = ch.quizQuestions.map((_, i) => i);
    if (shuffled) order = shuffle(order);
    renderSidebar();
    renderQuestion();
  }

  function renderQuestion() {
    const ch = App.state.chapters[currentChId];
    if (!ch || ch.quizQuestions.length === 0) {
      document.getElementById('quiz-question').textContent = '本章无自测题';
      return;
    }
    const realIdx = order[currentIdx];
    const q = ch.quizQuestions[realIdx];

    document.getElementById('quiz-counter').textContent = `${currentIdx + 1} / ${ch.quizQuestions.length}`;
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
    revealBtn.textContent = '显示答案';

    // 已判分则标记
    const prevJudge = (App.state.mastery[currentChId] || {})[`q-${realIdx}`];
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
  }

  function judge(verdict) {
    const ch = App.state.chapters[currentChId];
    const realIdx = order[currentIdx];
    const q = ch.quizQuestions[realIdx];
    AppStorage.recordAnswer(App.state, currentChId, realIdx, q.title, verdict);
    App.persist();
    App.showToast(verdict === 'right' ? '✓ 已记录' : '✗ 已加入错题');
    setTimeout(() => navigate(1), 350);
  }

  function navigate(delta) {
    const ch = App.state.chapters[currentChId];
    if (!ch) return;
    currentIdx = (currentIdx + delta + ch.quizQuestions.length) % ch.quizQuestions.length;
    renderQuestion();
  }

  function toggleShuffle() {
    shuffled = !shuffled;
    document.getElementById('quiz-shuffle').classList.toggle('active', shuffled);
    const ch = App.state.chapters[currentChId];
    if (ch) {
      order = ch.quizQuestions.map((_, i) => i);
      if (shuffled) order = shuffle(order);
      currentIdx = 0;
      renderQuestion();
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
        throwOnError: false
      });
    }
  }

  /* ============== 绑定 ============== */
  QuizView.bind = function () {
    document.getElementById('quiz-reveal').onclick = reveal;
    document.getElementById('quiz-prev').onclick = () => navigate(-1);
    document.getElementById('quiz-next').onclick = () => navigate(1);
    document.getElementById('quiz-shuffle').onclick = toggleShuffle;
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
