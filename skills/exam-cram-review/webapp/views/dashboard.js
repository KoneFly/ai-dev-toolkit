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
      `;
      row.style.cursor = 'pointer';
      row.onclick = () => App.openQuizForChapter(c.id);
      mountMast.appendChild(row);
    }

    // 最近错题
    const mountMis = document.getElementById('recent-mistakes');
    mountMis.innerHTML = '';
    if (App.state.mistakes.length === 0) {
      mountMis.innerHTML = '<div class="mistake-item" style="color:var(--text-mute)">暂无错题，开始练习吧～</div>';
    } else {
      for (const mis of App.state.mistakes.slice(0, 12)) {
        const ch = chapters[mis.chId];
        if (!ch) continue;
        const item = document.createElement('div');
        item.className = 'mistake-item';
        item.innerHTML = `
          <span class="chapter">${ch.name}</span>
          ${mis.title}
        `;
        item.style.cursor = 'pointer';
        item.onclick = () => App.openQuizForChapter(mis.chId, mis.qIdx);
        mountMis.appendChild(item);
      }
    }
  };

  global.DashboardView = DashboardView;
})(window);
