/* ==============================================================
 * views/knowledge.js - 知识总览视图
 * 展示考点清单 / 例题精讲 / 真题映射的完整 Markdown 内容
 * ============================================================== */

(function (global) {
  'use strict';

  const KnowledgeView = {};
  let currentChId = null;
  let currentTab = 'keypoints'; // 'keypoints' | 'examples' | 'examMapping'
  let searchQuery = '';
  let starFilter = 0; // 0 = 全部, 1-5 = 对应星级

  KnowledgeView.render = function (chId) {
    renderSidebar();
    if (chId) {
      selectChapter(chId);
    } else if (currentChId && App.state.chapters[currentChId]) {
      renderContent();
    } else {
      const list = Object.values(App.state.chapters || {}).sort((a, b) => a.number - b.number);
      if (list.length > 0) selectChapter(list[0].id);
    }
  };

  function selectChapter(chId) {
    currentChId = chId;
    renderSidebar();
    renderContent();
  }

  /* ============== 左侧章节列表 ============== */
  function renderSidebar() {
    const mount = document.getElementById('knowledge-chapter-list');
    if (!mount) return;
    mount.innerHTML = '';
    const chapters = App.state.chapters;
    if (!chapters) return;
    const list = Object.values(chapters).sort((a, b) => a.number - b.number);
    for (const c of list) {
      const li = document.createElement('li');
      const kpCount = (c.keypoints || []).length;
      const exCount = (c.examples || []).length;
      li.innerHTML = `
        <span>${c.name} ${'★'.repeat(c.star)}</span>
        <span class="count">${kpCount + exCount}</span>
      `;
      li.dataset.chId = c.id;
      if (c.id === currentChId) li.classList.add('active');
      li.onclick = () => selectChapter(c.id);
      mount.appendChild(li);
    }
  }

  /* ============== 右侧内容区 ============== */
  function renderContent() {
    const ch = App.state.chapters[currentChId];
    if (!ch) return;

    // 标题
    const titleEl = document.getElementById('knowledge-title');
    if (titleEl) titleEl.textContent = ch.name;

    // Tab 按钮状态
    document.querySelectorAll('#knowledge-tabs button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });

    // 统计
    const statsEl = document.getElementById('knowledge-stats');
    if (statsEl) {
      const kpCount = (ch.keypoints || []).length;
      const exCount = (ch.examples || []).length;
      const hasMapping = !!(ch.examMapping && ch.examMapping.trim());
      statsEl.innerHTML = `考点 <b>${kpCount}</b> · 例题 <b>${exCount}</b> · 真题映射 ${hasMapping ? '✓' : '—'}`;
    }

    // 内容区
    const mount = document.getElementById('knowledge-content');
    if (!mount) return;
    mount.innerHTML = '';

    if (currentTab === 'keypoints') {
      renderKeypoints(mount, ch);
    } else if (currentTab === 'examples') {
      renderExamples(mount, ch);
    } else if (currentTab === 'examMapping') {
      renderExamMapping(mount, ch);
    }

    renderMath(mount);
  }

  /* ============== 考点清单渲染 ============== */
  function renderKeypoints(mount, ch) {
    const kps = ch.keypoints || [];
    if (kps.length === 0) {
      mount.innerHTML = '<div class="knowledge-empty">本章暂无考点数据</div>';
      return;
    }

    // 筛选
    let filtered = kps;
    if (starFilter > 0) {
      filtered = kps.filter(kp => kp.star >= starFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(kp =>
        (kp.title || '').toLowerCase().includes(q) ||
        (kp.body || '').toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      mount.innerHTML = '<div class="knowledge-empty">无匹配考点</div>';
      return;
    }

    for (const kp of filtered) {
      const card = document.createElement('div');
      card.className = 'knowledge-card';

      const starStr = '★'.repeat(kp.star || 3);
      const starClass = (kp.star || 3) >= 3 ? 'star-high' : (kp.star || 3) >= 2 ? 'star-mid' : 'star-low';

      // 看该考点关联的自测题有没有做过
      const relatedQuiz = findRelatedQuiz(ch, kp.title);

      card.innerHTML = `
        <div class="knowledge-card-header" data-expanded="false">
          <span class="knowledge-star ${starClass}">${starStr}</span>
          <span class="knowledge-card-title">${escapeHtml(kp.title)}</span>
          ${relatedQuiz ? `<span class="knowledge-quiz-badge" title="有关联自测题">${relatedQuiz.done ? '✓ 已练' : '○ 未练'}</span>` : ''}
          <span class="knowledge-toggle">▸</span>
        </div>
        <div class="knowledge-card-body" hidden></div>
      `;

      const header = card.querySelector('.knowledge-card-header');
      const body = card.querySelector('.knowledge-card-body');

      header.onclick = () => {
        const expanded = header.dataset.expanded === 'true';
        header.dataset.expanded = String(!expanded);
        body.hidden = expanded;
        header.querySelector('.knowledge-toggle').textContent = expanded ? '▸' : '▾';
        if (!expanded && !body.dataset.rendered) {
          body.innerHTML = marked.parse(kp.body || '（无详细内容）');
          body.dataset.rendered = 'true';
          renderMath(body);
        }
      };

      mount.appendChild(card);
    }
  }

  /* ============== 例题精讲渲染 ============== */
  function renderExamples(mount, ch) {
    const exs = ch.examples || [];
    if (exs.length === 0) {
      mount.innerHTML = '<div class="knowledge-empty">本章暂无例题数据</div>';
      return;
    }

    let filtered = exs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = exs.filter(ex =>
        (ex.title || '').toLowerCase().includes(q) ||
        (ex.body || '').toLowerCase().includes(q)
      );
    }

    for (const ex of filtered) {
      const card = document.createElement('div');
      card.className = 'knowledge-card';

      card.innerHTML = `
        <div class="knowledge-card-header" data-expanded="false">
          <span class="knowledge-card-icon">📝</span>
          <span class="knowledge-card-title">${escapeHtml(ex.title)}</span>
          <span class="knowledge-toggle">▸</span>
        </div>
        <div class="knowledge-card-body" hidden></div>
      `;

      const header = card.querySelector('.knowledge-card-header');
      const body = card.querySelector('.knowledge-card-body');

      header.onclick = () => {
        const expanded = header.dataset.expanded === 'true';
        header.dataset.expanded = String(!expanded);
        body.hidden = expanded;
        header.querySelector('.knowledge-toggle').textContent = expanded ? '▸' : '▾';
        if (!expanded && !body.dataset.rendered) {
          body.innerHTML = marked.parse(ex.body || '（无详细内容）');
          body.dataset.rendered = 'true';
          renderMath(body);
        }
      };

      mount.appendChild(card);
    }
  }

  /* ============== 真题映射渲染 ============== */
  function renderExamMapping(mount, ch) {
    const mapping = ch.examMapping;
    if (!mapping || !mapping.trim()) {
      mount.innerHTML = '<div class="knowledge-empty">本章暂无真题映射数据</div>';
      return;
    }

    const container = document.createElement('div');
    container.className = 'knowledge-mapping-content markdown-content';
    container.innerHTML = marked.parse(mapping);
    mount.appendChild(container);
    renderMath(container);
  }

  /* ============== 工具函数 ============== */
  function findRelatedQuiz(ch, keypointTitle) {
    if (!ch.quizQuestions || !ch.quizQuestions.length) return null;
    const related = ch.quizQuestions.find(q =>
      (q.title || '').includes(keypointTitle) || (q.question || '').includes(keypointTitle)
    );
    if (!related) return null;
    const idx = ch.quizQuestions.indexOf(related);
    const mastery = (App.state.mastery[ch.id] || {})[`q-${idx}`];
    return { done: !!mastery };
  }

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

  /* ============== 绑定 ============== */
  KnowledgeView.bind = function () {
    // Tab 切换
    document.querySelectorAll('#knowledge-tabs button').forEach(btn => {
      btn.onclick = () => {
        currentTab = btn.dataset.tab;
        renderContent();
      };
    });

    // 搜索
    const searchEl = document.getElementById('knowledge-search');
    if (searchEl) {
      searchEl.oninput = (e) => {
        searchQuery = e.target.value.trim();
        renderContent();
      };
    }

    // 星级筛选
    document.querySelectorAll('#knowledge-star-filter button').forEach(btn => {
      btn.onclick = () => {
        starFilter = parseInt(btn.dataset.star) || 0;
        document.querySelectorAll('#knowledge-star-filter button').forEach(b =>
          b.classList.toggle('active', b === btn)
        );
        renderContent();
      };
    });
  };

  global.KnowledgeView = KnowledgeView;
})(window);
