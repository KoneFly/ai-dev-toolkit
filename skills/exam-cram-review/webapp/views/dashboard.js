/* ==============================================================
 * views/dashboard.js - 仪表盘
 * ============================================================== */

(function (global) {
  'use strict';

  const DashboardView = {};

  DashboardView.render = function () {
    const chapters = App.state.chapters;
    if (!chapters) return;

    const stats = AppStorage.computeGlobalStats(App.state, chapters);
    document.getElementById('stat-chapters').textContent = stats.chapterCount;
    document.getElementById('stat-questions').textContent = stats.questionCount;
    document.getElementById('stat-correct').textContent = stats.correctRate + '%';
    document.getElementById('stat-weak').textContent = stats.weakest;

    // 章节掌握度列表
    const mountMast = document.getElementById('chapter-mastery');
    mountMast.innerHTML = '';
    const sorted = Object.values(chapters).sort((a, b) => a.number - b.number);
    for (const c of sorted) {
      const m = AppStorage.computeMastery(App.state, c);
      const pct = Math.round(m.rate * 100);
      const row = document.createElement('div');
      row.className = 'mastery-row';
      row.innerHTML = `
        <span class="mastery-name">${c.name} ${'★'.repeat(c.star)}</span>
        <div class="mastery-bar"><div class="mastery-fill ${m.level}" style="width:${pct}%"></div></div>
        <span class="mastery-pct">${m.right + m.wrong > 0 ? pct + '%' : '—'}</span>
        <button class="row-edit" title="在编辑器中打开">📝</button>
      `;
      row.style.cursor = 'pointer';
      row.onclick = (e) => {
        if (e.target.classList.contains('row-edit')) {
          e.stopPropagation();
          App.openInEditor(c.id);
        } else {
          App.openQuizForChapter(c.id);
        }
      };
      mountMast.appendChild(row);
    }

    // 最近错题
    const mountMis = document.getElementById('recent-mistakes');
    mountMis.innerHTML = '';
    if (App.state.mistakes.length === 0) {
      mountMis.innerHTML = '<div class="mistake-item" style="color:var(--ink-fade)">暂无错题，开始练习吧～</div>';
    } else {
      for (const mis of App.state.mistakes.slice(0, 12)) {
        const ch = chapters[mis.chId];
        if (!ch) continue;
        const item = document.createElement('div');
        item.className = 'mistake-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.innerHTML = `
          <span class="chapter">${ch.name}</span>
          <span style="flex:1;">${mis.title || '(无标题)'}</span>
          <button class="row-edit" data-act="open" title="重做此题">▶️</button>
          <button class="row-edit" data-act="explain" title="让 AI 讲解此题">🤖</button>
        `;
        item.querySelector('[data-act="open"]').onclick = (e) => {
          e.stopPropagation();
          App.openQuizForChapter(mis.chId, mis.qIdx);
        };
        item.querySelector('[data-act="explain"]').onclick = (e) => {
          e.stopPropagation();
          if (window.AIView && AIView.explainMistake) {
            AIView.explainMistake(mis.chId, mis.qIdx);
          } else {
            App.showToast('AI 讲解功能未加载');
          }
        };
        mountMis.appendChild(item);
      }
    }
  };

  global.DashboardView = DashboardView;
})(window);
