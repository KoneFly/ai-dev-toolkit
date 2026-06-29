/* ==============================================================
 * views/formula.js - 公式速查（Heptabase 风格 + Anki 卡牌背诵 + 关系高亮）
 * ============================================================== */

(function (global) {
  'use strict';

  const FormulaView = {};
  let currentChId = 'all';
  let testMode = false;
  let importanceFilter = 'all';
  let masteryFilter = 'all'; // 'all' | 'untouched' | 'right' | 'wrong'
  let viewMode = 'grid'; // 'grid' | 'table'

  // Anki 模式状态
  let ankiMode = false;
  let ankiList = [];
  let ankiIndex = 0;
  let ankiRightCount = 0;
  let ankiWrongCount = 0;
  let ankiWrongs = [];

  FormulaView.render = function () {
    renderSelect();
    if (ankiMode) {
      // 保持在 Anki 模式渲染
      showAnkiCard();
    } else {
      renderCards();
    }
  };

  function getFormulaStatus(chId, fName) {
    const fMastery = App.state.formulaMastery || {};
    const chMastery = fMastery[chId] || {};
    return chMastery[fName] || 'untouched'; // 'right' | 'wrong' | 'untouched'
  }

  function renderSelect() {
    const sel = document.getElementById('formula-chapter-select');
    if (!sel) return;
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = 'all'; opt0.textContent = '全部章节';
    sel.appendChild(opt0);

    const list = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);
    for (const c of list) {
      if (c.formulas.length === 0) continue;
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = `${c.name} (${c.formulas.length})`;
      sel.appendChild(o);
    }
    sel.value = currentChId;
  }

  function getFilteredFormulas() {
    const chapters = currentChId === 'all'
      ? Object.values(App.state.chapters).sort((a, b) => a.number - b.number)
      : [App.state.chapters[currentChId]].filter(Boolean);

    const formulas = [];
    for (const ch of chapters) {
      ch.formulas.forEach((f, idx) => {
        // 1. 重要级过滤
        if (importanceFilter !== 'all' && (f.importance || 'normal') !== importanceFilter) return;

        // 2. 掌握度过滤
        const status = getFormulaStatus(ch.id, f.name);
        if (masteryFilter !== 'all') {
          if (masteryFilter === 'untouched' && status !== 'untouched') return;
          if (masteryFilter === 'right' && status !== 'right') return;
          if (masteryFilter === 'wrong' && status !== 'wrong') return;
        }

        formulas.push({ ch, f, idx });
      });
    }
    return formulas;
  }

  function renderCards() {
    // 隐藏 Anki 面板和结算战报，恢复显示 toolbar 与卡片容器
    document.getElementById('formula-anki-container').classList.add('hidden');
    document.getElementById('formula-anki-report').classList.add('hidden');
    document.getElementById('formula-tables').style.display = 'block';

    const mount = document.getElementById('formula-tables');
    mount.innerHTML = '';

    const allFormulas = getFilteredFormulas();

    // 随机测试处理
    let testIndices = null;
    if (testMode && allFormulas.length > 0) {
      const n = Math.min(8, Math.ceil(allFormulas.length * 0.4));
      testIndices = randomIndices(allFormulas.length, n);
    }

    if (allFormulas.length === 0) {
      mount.innerHTML = '<div class="empty-state">无匹配的公式（试着切换章节、重要级或背诵状态筛选）</div>';
      return;
    }

    if (viewMode === 'table') {
      renderTableMode(allFormulas, testIndices);
    } else {
      renderGridMode(allFormulas, testIndices);
    }
  }

  /* ============== 1. 网格卡片模式 ============== */
  function renderGridMode(allFormulas, testIndices) {
    const mount = document.getElementById('formula-tables');
    let curChId = null;
    let curWrap = null;
    let curGrid = null;

    allFormulas.forEach((item, idx) => {
      if (item.ch.id !== curChId) {
        curChId = item.ch.id;
        curWrap = document.createElement('div');
        curWrap.className = 'formula-section-wrap';
        const h = document.createElement('h3');
        h.innerHTML = `${item.ch.name} · ${item.ch.formulas.length} 条`;
        curWrap.appendChild(h);
        curGrid = document.createElement('div');
        curGrid.className = 'formula-grid';
        curWrap.appendChild(curGrid);
        mount.appendChild(curWrap);
      }
      const isMasked = testMode ? testIndices.has(idx) : true;
      curGrid.appendChild(buildCard(item.ch.id, item.f, isMasked, item.idx));
    });
  }

  function buildCard(chId, f, isMasked, fIdx) {
    const imp = f.importance || 'normal';
    const card = document.createElement('div');
    card.className = `formula-card imp-${imp}`;

    // 计算标准公式 ID（用于 hover 关联）
    const formulaId = `公式${parseInt(chId)}.${fIdx + 1}`;
    card.dataset.formulaId = formulaId;

    const hasDetail = f.meaning || f.derivation || f.application || f.related;
    const status = getFormulaStatus(chId, f.name);

    // 掌握度小圆点
    const statusDot = status === 'right' 
      ? '<span style="color:#16a34a;margin-left:4px;" title="已掌握">✓</span>' 
      : (status === 'wrong' ? '<span style="color:#dc2626;margin-left:4px;" title="未掌握/记错">✗</span>' : '');

    card.innerHTML = `
      <div class="card-header">
        <span class="card-name">${escapeHtml(f.name || '—')}${statusDot}</span>
        ${IMP_BADGE[imp] || ''}
        ${hasDetail ? '<button class="card-toggle" title="展开详情">▾</button>' : ''}
      </div>
      <div class="card-formula ${isMasked ? 'glassy-masked' : ''}"
           data-formula="${escapeAttr(f.formula)}">
        ${isMasked ? '<span class="mask-label">🔑 点击揭示公式</span>' : renderInline(f.formula)}
      </div>
      ${(f.condition || f.note) ? `
      <div class="card-aux">
        ${f.condition ? `<div class="aux-item"><span class="aux-lbl">条件</span>${escapeHtml(f.condition)}</div>` : ''}
        ${f.note ? `<div class="aux-item"><span class="aux-lbl">备注</span>${escapeHtml(f.note)}</div>` : ''}
      </div>
      ` : ''}
      ${hasDetail ? `
      <div class="card-detail hidden">
        ${f.meaning ? `<div class="detail-block"><h5>📖 物理含义 / 核心要点</h5><p>${escapeHtml(f.meaning)}</p></div>` : ''}
        ${f.derivation ? `<div class="detail-block"><h5>🧮 推导起点</h5><p>${escapeHtml(f.derivation)}</p></div>` : ''}
        ${f.application ? `<div class="detail-block"><h5>🎯 应用场景</h5><p>${escapeHtml(f.application)}</p></div>` : ''}
        ${f.related ? `<div class="detail-block"><h5>🔗 关联公式</h5><p>${escapeHtml(f.related)}</p></div>` : ''}
      </div>
      ` : ''}
    `;

    // 公式遮盖切换
    const fEl = card.querySelector('.card-formula');
    fEl.onclick = () => toggleMask(fEl);

    // 详情展开
    const toggleBtn = card.querySelector('.card-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        const det = card.querySelector('.card-detail');
        det.classList.toggle('hidden');
        toggleBtn.textContent = det.classList.contains('hidden') ? '▾' : '▴';
        if (!det.classList.contains('hidden')) renderMathIn(det);
      };
    }

    // 关联高亮绑定
    card.onmouseenter = () => {
      const upRefs = extractFormulaRefs(f.derivation);
      const downRefs = extractFormulaRefs(f.related);
      upRefs.forEach(ref => {
        const target = document.querySelector(`.formula-card[data-formula-id="${ref}"]`);
        if (target) target.classList.add('glow-upstream');
      });
      downRefs.forEach(ref => {
        const target = document.querySelector(`.formula-card[data-formula-id="${ref}"]`);
        if (target) target.classList.add('glow-downstream');
      });
    };
    card.onmouseleave = () => {
      document.querySelectorAll('.formula-card').forEach(c => {
        c.classList.remove('glow-upstream', 'glow-downstream');
      });
    };

    return card;
  }

  function extractFormulaRefs(text) {
    if (!text) return [];
    // 匹配如 "公式 4.1" 或 "公式 11.2" 等
    const matches = text.match(/公式\s*\d+\.\d+/g);
    return matches ? matches.map(m => m.replace(/\s+/g, '')) : [];
  }

  /* ============== 2. 紧凑表格模式 ============== */
  function renderTableMode(allFormulas, testIndices) {
    const mount = document.getElementById('formula-tables');
    const table = document.createElement('table');
    table.className = 'formula-compact-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:20%">公式名称</th>
          <th style="width:40%">公式内容</th>
          <th style="width:20%">适用条件</th>
          <th style="width:20%">备注</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    allFormulas.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const isMasked = testMode ? testIndices.has(idx) : true;
      const status = getFormulaStatus(item.ch.id, item.f.name);
      const statusDot = status === 'right' 
        ? '<span style="color:#16a34a;margin-left:4px;">✓</span>' 
        : (status === 'wrong' ? '<span style="color:#dc2626;margin-left:4px;">✗</span>' : '');

      tr.innerHTML = `
        <td style="font-weight:600;">
          <span style="font-size:12px;color:var(--text-mute);margin-right:6px;">Ch${item.ch.id}</span>
          ${escapeHtml(item.f.name || '—')}${statusDot}
        </td>
        <td>
          <div class="compact-formula-cell ${isMasked ? 'glassy-masked' : ''}" 
               data-formula="${escapeAttr(item.f.formula)}">
            ${isMasked ? '<span class="mask-label">🔑 点击揭示</span>' : renderInline(item.f.formula)}
          </div>
        </td>
        <td style="font-size:13px;color:var(--text-mute);">${escapeHtml(item.f.condition || '—')}</td>
        <td style="font-size:13px;color:var(--text-mute);">${escapeHtml(item.f.note || '—')}</td>
      `;

      const fCell = tr.querySelector('.compact-formula-cell');
      fCell.onclick = () => {
        if (fCell.classList.contains('glassy-masked')) {
          fCell.classList.remove('glassy-masked');
          fCell.innerHTML = renderInline(fCell.dataset.formula);
          renderMathIn(fCell);
        } else {
          fCell.classList.add('glassy-masked');
          fCell.innerHTML = '<span class="mask-label">🔑 点击揭示</span>';
        }
      };

      tbody.appendChild(tr);
    });

    mount.appendChild(table);
  }

  const IMP_BADGE = {
    must: '<span class="imp-badge must">必背</span>',
    familiar: '<span class="imp-badge familiar">熟悉</span>',
    know: '<span class="imp-badge know">了解</span>',
    normal: ''
  };

  function toggleMask(el) {
    if (el.classList.contains('glassy-masked')) {
      el.classList.remove('glassy-masked');
      el.innerHTML = renderInline(el.dataset.formula);
      renderMathIn(el);
    } else {
      el.classList.add('glassy-masked');
      el.innerHTML = '<span class="mask-label">🔑 点击揭示公式</span>';
    }
  }

  function maskAll() {
    document.querySelectorAll('.card-formula').forEach(el => {
      el.classList.add('glassy-masked');
      el.innerHTML = '<span class="mask-label">🔑 点击揭示公式</span>';
    });
    document.querySelectorAll('.compact-formula-cell').forEach(el => {
      el.classList.add('glassy-masked');
      el.innerHTML = '<span class="mask-label">🔑 点击揭示</span>';
    });
  }

  function showAll() {
    document.querySelectorAll('.card-formula').forEach(el => {
      el.classList.remove('glassy-masked');
      el.innerHTML = renderInline(el.dataset.formula);
    });
    document.querySelectorAll('.compact-formula-cell').forEach(el => {
      el.classList.remove('glassy-masked');
      el.innerHTML = renderInline(el.dataset.formula);
    });
    renderMathIn(document.getElementById('formula-tables'));
  }

  function startTest() {
    testMode = !testMode;
    document.getElementById('formula-random-test').classList.toggle('active', testMode);
    renderCards();
  }

  function setImportance(filter) {
    importanceFilter = filter;
    document.querySelectorAll('.importance-filter button').forEach(b => {
      b.classList.toggle('active', b.dataset.imp === filter);
    });
    renderCards();
  }

  function setMasteryFilter(val) {
    masteryFilter = val;
    renderCards();
  }

  function setViewMode(mode) {
    viewMode = mode;
    document.getElementById('formula-view-grid').classList.toggle('active', mode === 'grid');
    document.getElementById('formula-view-table').classList.toggle('active', mode === 'table');
    renderCards();
  }

  /* ============== 3. Anki 背诵模式实现 ============== */
  function startAnkiMode() {
    const list = getFilteredFormulas();
    if (list.length === 0) {
      App.showToast('当前筛选条件下没有可以背诵的公式');
      return;
    }
    // 随机打乱列表
    ankiList = shuffle(list);
    ankiIndex = 0;
    ankiRightCount = 0;
    ankiWrongCount = 0;
    ankiWrongs = [];
    ankiMode = true;

    // 隐藏主表格与战报面板
    document.getElementById('formula-tables').style.display = 'none';
    document.getElementById('formula-anki-report').classList.add('hidden');
    document.getElementById('formula-anki-container').classList.remove('hidden');

    showAnkiCard();
    App.showToast('进入卡牌背诵模式，可用 [空格] 翻牌，[1] 没记住，[2] 记住了，[Esc] 退出');
  }

  function exitAnkiMode() {
    ankiMode = false;
    document.getElementById('formula-anki-container').classList.add('hidden');
    document.getElementById('formula-anki-report').classList.add('hidden');
    renderCards();
  }

  function showAnkiCard() {
    if (ankiIndex >= ankiList.length) {
      showAnkiReport();
      return;
    }

    const item = ankiList[ankiIndex];
    const chId = item.ch.id;
    const f = item.f;

    document.getElementById('anki-progress').textContent = `${ankiIndex + 1} / ${ankiList.length}`;
    
    // 正面填充
    const badge = document.getElementById('anki-badge');
    badge.className = `anki-badge imp-${f.importance || 'normal'}`;
    badge.textContent = IMP_TEXT[f.importance || 'normal'] || '一般';
    document.getElementById('anki-name').textContent = f.name || '未命名公式';

    const condWrap = document.getElementById('anki-condition-wrap');
    if (f.condition) {
      condWrap.classList.remove('hidden');
      document.getElementById('anki-condition').textContent = f.condition;
    } else {
      condWrap.classList.add('hidden');
      document.getElementById('anki-condition').textContent = '';
    }

    const noteWrap = document.getElementById('anki-note-wrap');
    if (f.note) {
      noteWrap.classList.remove('hidden');
      document.getElementById('anki-note').textContent = f.note;
    } else {
      noteWrap.classList.add('hidden');
      document.getElementById('anki-note').textContent = '';
    }

    // 隐藏背面
    document.getElementById('anki-card-back').classList.add('hidden');
    document.getElementById('anki-reveal-btn').classList.remove('hidden');
    document.getElementById('anki-judge-actions').classList.add('hidden');

    // 渲染正面可能含有的 LaTeX
    renderMathIn(document.getElementById('anki-card'));
  }

  const IMP_TEXT = { must: '必背', familiar: '熟悉', know: '了解', normal: '一般' };

  function revealAnkiFormula() {
    const item = ankiList[ankiIndex];
    const f = item.f;

    // 触发 3D 翻转动画
    const cardEl = document.getElementById('anki-card');
    cardEl.classList.add('flipping');
    setTimeout(() => cardEl.classList.remove('flipping'), 600);

    // 显示背面
    document.getElementById('anki-formula-math').innerHTML = renderInline(f.formula);
    
    const meaningWrap = document.getElementById('anki-meaning-wrap');
    if (f.meaning) {
      meaningWrap.classList.remove('hidden');
      document.getElementById('anki-meaning').textContent = f.meaning;
    } else {
      meaningWrap.classList.add('hidden');
      document.getElementById('anki-meaning').textContent = '';
    }

    const derWrap = document.getElementById('anki-derivation-wrap');
    if (f.derivation) {
      derWrap.classList.remove('hidden');
      document.getElementById('anki-derivation').textContent = f.derivation;
    } else {
      derWrap.classList.add('hidden');
      document.getElementById('anki-derivation').textContent = '';
    }

    const appWrap = document.getElementById('anki-application-wrap');
    if (f.application) {
      appWrap.classList.remove('hidden');
      document.getElementById('anki-application').textContent = f.application;
    } else {
      appWrap.classList.add('hidden');
      document.getElementById('anki-application').textContent = '';
    }

    document.getElementById('anki-card-back').classList.remove('hidden');
    document.getElementById('anki-reveal-btn').classList.add('hidden');
    document.getElementById('anki-judge-actions').classList.remove('hidden');

    // 渲染数学公式
    renderMathIn(document.getElementById('anki-card-back'));
  }

  function judgeAnki(judge) {
    const item = ankiList[ankiIndex];
    
    // 保存至 LocalStorage
    AppStorage.recordFormulaAnswer(App.state, item.ch.id, item.f.name, judge);
    AppStorage.save(App.state);

    if (judge === 'right') {
      ankiRightCount++;
    } else {
      ankiWrongCount++;
      ankiWrongs.push(item);
    }

    ankiIndex++;
    showAnkiCard();
  }

  function showAnkiReport() {
    document.getElementById('formula-anki-container').classList.add('hidden');
    const rep = document.getElementById('formula-anki-report');
    rep.classList.remove('hidden');

    document.getElementById('report-total').textContent = ankiList.length;
    document.getElementById('report-right').textContent = ankiRightCount;
    document.getElementById('report-wrong').textContent = ankiWrongCount;

    const retryBtn = document.getElementById('report-retry-wrong-btn');
    if (ankiWrongs.length > 0) {
      retryBtn.classList.remove('hidden');
      retryBtn.textContent = `🔁 温习错题 (${ankiWrongs.length})`;
    } else {
      retryBtn.classList.add('hidden');
    }
  }

  function retryWrongs() {
    ankiList = shuffle([...ankiWrongs]);
    ankiIndex = 0;
    ankiRightCount = 0;
    ankiWrongCount = 0;
    ankiWrongs = [];

    document.getElementById('formula-anki-report').classList.add('hidden');
    document.getElementById('formula-anki-container').classList.remove('hidden');
    showAnkiCard();
  }

  function restartAnki() {
    startAnkiMode();
  }

  /* ============== 4. 键盘事件监听 ============== */
  function handleAnkiKey(e) {
    if (!ankiMode) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      const revealBtn = document.getElementById('anki-reveal-btn');
      if (revealBtn && !revealBtn.classList.contains('hidden') && revealBtn.offsetHeight > 0) {
        revealAnkiFormula();
      }
    } else if (e.key === '1') {
      const wrongBtn = document.querySelector('#anki-judge-actions .judge-btn.wrong');
      if (wrongBtn && !wrongBtn.classList.contains('hidden') && wrongBtn.offsetHeight > 0) {
        judgeAnki('wrong');
      }
    } else if (e.key === '2') {
      const rightBtn = document.querySelector('#anki-judge-actions .judge-btn.right');
      if (rightBtn && !rightBtn.classList.contains('hidden') && rightBtn.offsetHeight > 0) {
        judgeAnki('right');
      }
    } else if (e.code === 'Escape') {
      exitAnkiMode();
    }
  }

  /* ============== 基础工具函数 ============== */
  function renderInline(formula) {
    if (!formula) return '';
    return marked.parseInline(formula);
  }

  function renderMathIn(el) {
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
  
  function randomIndices(total, n) {
    const all = Array.from({ length: total }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return new Set(all.slice(0, n));
  }

  function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* ============== 事件绑定 ============== */
  FormulaView.bind = function () {
    document.getElementById('formula-chapter-select').onchange = e => {
      currentChId = e.target.value;
      testMode = false;
      document.getElementById('formula-random-test').classList.remove('active');
      exitAnkiMode();
    };
    document.getElementById('formula-show-all').onclick = showAll;
    document.getElementById('formula-hide-all').onclick = maskAll;
    document.getElementById('formula-random-test').onclick = startTest;
    
    document.querySelectorAll('.importance-filter button').forEach(b => {
      b.onclick = () => setImportance(b.dataset.imp);
    });

    // 掌握度多维筛选绑定
    document.getElementById('formula-mastery-filter').onchange = e => {
      setMasteryFilter(e.target.value);
    };

    // 模式切换绑定
    document.getElementById('formula-view-grid').onclick = () => setViewMode('grid');
    document.getElementById('formula-view-table').onclick = () => setViewMode('table');

    // Anki 背诵模式控件绑定
    document.getElementById('formula-anki-btn').onclick = startAnkiMode;
    document.getElementById('anki-close-btn').onclick = exitAnkiMode;
    document.getElementById('anki-reveal-btn').onclick = revealAnkiFormula;
    
    document.querySelectorAll('#anki-judge-actions button').forEach(btn => {
      btn.onclick = () => judgeAnki(btn.dataset.judge);
    });

    // 战报绑定
    document.getElementById('report-retry-wrong-btn').onclick = retryWrongs;
    document.getElementById('report-restart-btn').onclick = restartAnki;
    document.getElementById('report-close-btn').onclick = exitAnkiMode;

    // 全局键盘事件注册 (防抖及视图防污染处理)
    window.addEventListener('keydown', handleAnkiKey);
  };

  global.FormulaView = FormulaView;
})(window);
