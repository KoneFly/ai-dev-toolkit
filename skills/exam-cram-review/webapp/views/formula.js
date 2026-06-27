/* ==============================================================
 * views/formula.js - 公式速查（遮盖模式）
 * 默认整张表，公式列可点击揭示
 * 随机测试模式：随机遮盖 N 个公式
 * ============================================================== */

(function (global) {
  'use strict';

  const FormulaView = {};
  let currentChId = 'all';
  let testMode = false;

  FormulaView.render = function () {
    renderSelect();
    renderTables();
  };

  function renderSelect() {
    const sel = document.getElementById('formula-chapter-select');
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

  function renderTables() {
    const mount = document.getElementById('formula-tables');
    mount.innerHTML = '';

    const chapters = currentChId === 'all'
      ? Object.values(App.state.chapters).sort((a, b) => a.number - b.number)
      : [App.state.chapters[currentChId]].filter(Boolean);

    const totalCount = chapters.reduce((s, c) => s + c.formulas.length, 0);
    let testIndices = null;
    if (testMode && totalCount > 0) {
      const n = Math.min(8, Math.ceil(totalCount * 0.4));
      testIndices = randomIndices(totalCount, n);
    }

    let globalIdx = 0;
    for (const ch of chapters) {
      if (ch.formulas.length === 0) continue;
      const wrap = document.createElement('div');
      wrap.className = 'formula-table-wrap';

      const h = document.createElement('h3');
      h.textContent = `${ch.name} · ${ch.formulas.length} 条`;
      wrap.appendChild(h);

      const table = document.createElement('table');
      table.className = 'formula-table';
      table.innerHTML = `
        <thead>
          <tr><th style="width:20%">名称</th><th>公式</th><th style="width:18%">条件</th><th style="width:24%">备注</th></tr>
        </thead>
        <tbody></tbody>`;
      const tbody = table.querySelector('tbody');

      for (const f of ch.formulas) {
        const tr = document.createElement('tr');
        if (testMode && testIndices && testIndices.has(globalIdx)) tr.classList.add('testing');

        const isMasked = testMode ? testIndices.has(globalIdx) : true;

        tr.innerHTML = `
          <td>${escapeHtml(f.name || '—')}</td>
          <td class="formula-cell ${isMasked ? 'masked' : ''}"
              data-formula="${escapeAttr(f.formula)}">
            ${isMasked ? '' : renderInline(f.formula)}
          </td>
          <td>${escapeHtml(f.condition || '')}</td>
          <td>${escapeHtml(f.note || '')}</td>
        `;
        tr.onclick = () => toggleCell(tr.querySelector('.formula-cell'));
        tbody.appendChild(tr);
        globalIdx++;
      }
      wrap.appendChild(table);
      mount.appendChild(wrap);
    }

    if (totalCount === 0) {
      mount.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-mute)">本章/全部章节均无公式</div>';
    }
  }

  function toggleCell(cell) {
    if (!cell) return;
    if (cell.classList.contains('masked')) {
      cell.classList.remove('masked');
      cell.innerHTML = renderInline(cell.dataset.formula);
      if (window.renderMathInElement) {
        renderMathInElement(cell, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    } else {
      cell.classList.add('masked');
      cell.innerHTML = '';
    }
  }

  function maskAll() {
    document.querySelectorAll('.formula-cell').forEach(c => {
      c.classList.add('masked');
      c.innerHTML = '';
    });
  }
  function showAll() {
    document.querySelectorAll('.formula-cell').forEach(c => {
      c.classList.remove('masked');
      c.innerHTML = renderInline(c.dataset.formula);
    });
    if (window.renderMathInElement) {
      renderMathInElement(document.getElementById('formula-tables'), {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }

  function startTest() {
    testMode = !testMode;
    document.getElementById('formula-random-test').classList.toggle('active', testMode);
    renderTables();
  }

  function renderInline(formula) {
    if (!formula) return '';
    // formula 可能含 $$..$$，剥皮交给 KaTeX 自动渲染
    return marked.parseInline(formula);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function randomIndices(total, n) {
    const all = Array.from({ length: total }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return new Set(all.slice(0, n));
  }

  FormulaView.bind = function () {
    document.getElementById('formula-chapter-select').onchange = e => {
      currentChId = e.target.value;
      testMode = false;
      document.getElementById('formula-random-test').classList.remove('active');
      renderTables();
    };
    document.getElementById('formula-show-all').onclick = showAll;
    document.getElementById('formula-hide-all').onclick = maskAll;
    document.getElementById('formula-random-test').onclick = startTest;
  };

  global.FormulaView = FormulaView;
})(window);
