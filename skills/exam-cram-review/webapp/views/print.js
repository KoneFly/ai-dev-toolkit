/* ==============================================================
 * views/print.js - 全局 PDF 导出（浏览器打印）
 * 模式：考点总览 / 公式海报 / 完整导出
 * ============================================================== */

(function (global) {
  'use strict';

  const PrintView = {};

  /* ============== 导出弹窗 ============== */
  PrintView.showExportDialog = function () {
    const chapters = App.state.chapters;
    if (!chapters || Object.keys(chapters).length === 0) {
      App.showToast('请先加载复习目录');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>🖨 导出 PDF / 打印</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">选择导出模式，浏览器会弹出打印对话框，选"另存为 PDF"即可</p>
          <div class="print-modes">
            <button class="print-mode-btn" data-mode="keypoints">
              <span class="print-mode-icon">📋</span>
              <span class="print-mode-title">考点总览</span>
              <span class="print-mode-desc">全部章节考点清单（按星级排列）</span>
            </button>
            <button class="print-mode-btn" data-mode="formulas">
              <span class="print-mode-icon">📐</span>
              <span class="print-mode-title">公式速查表</span>
              <span class="print-mode-desc">紧凑排版，适合打印一页纸带进考场</span>
            </button>
            <button class="print-mode-btn" data-mode="all">
              <span class="print-mode-icon">📚</span>
              <span class="print-mode-title">完整导出</span>
              <span class="print-mode-desc">考点 + 例题 + 公式 + 真题映射</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-cancel">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => document.body.removeChild(overlay);
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.modal-cancel').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };

    overlay.querySelectorAll('.print-mode-btn').forEach(btn => {
      btn.onclick = () => {
        const mode = btn.dataset.mode;
        close();
        executePrint(mode);
      };
    });
  };

  /* ============== 执行打印 ============== */
  function executePrint(mode) {
    const area = document.getElementById('print-area');
    const chapters = Object.values(App.state.chapters).sort((a, b) => a.number - b.number);

    area.innerHTML = '';

    if (mode === 'keypoints') buildKeypoints(area, chapters);
    else if (mode === 'formulas') buildFormulas(area, chapters);
    else if (mode === 'all') buildAll(area, chapters);

    // 渲染 KaTeX
    renderMath(area);

    // 标记 body 进入打印模式，触发 @media print 样式
    document.body.classList.add('printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing');
      area.innerHTML = '';
    }, 300);
  }

  /* ============== 考点总览 ============== */
  function buildKeypoints(area, chapters) {
    area.innerHTML = `<h1 class="print-title">📋 考点总览</h1>`;
    for (const ch of chapters) {
      if (!ch.keypoints || !ch.keypoints.length) continue;
      const section = document.createElement('div');
      section.className = 'print-chapter';
      let html = `<h2>${ch.name} ${'★'.repeat(ch.star)}</h2>`;
      const sorted = [...ch.keypoints].sort((a, b) => (b.star || 3) - (a.star || 3));
      for (const kp of sorted) {
        const stars = '★'.repeat(kp.star || 3);
        html += `<div class="print-kp">
          <h3><span class="print-star">${stars}</span> ${esc(kp.title)}</h3>
          <div class="print-kp-body">${marked.parse(kp.body || '')}</div>
        </div>`;
      }
      section.innerHTML = html;
      area.appendChild(section);
    }
  }

  /* ============== 公式速查表 ============== */
  function buildFormulas(area, chapters) {
    area.innerHTML = `<h1 class="print-title">📐 公式速查表</h1>`;
    for (const ch of chapters) {
      if (!ch.formulas || !ch.formulas.length) continue;
      const section = document.createElement('div');
      section.className = 'print-chapter print-formulas-chapter';
      let html = `<h2>${ch.name}</h2><table class="print-formula-table">
        <thead><tr><th>公式名</th><th>公式</th><th>条件</th></tr></thead><tbody>`;
      for (const f of ch.formulas) {
        html += `<tr>
          <td class="print-fname">${esc(f.name || '')}</td>
          <td class="print-fmath">${f.formula || ''}</td>
          <td class="print-fcond">${esc(f.condition || '')}</td>
        </tr>`;
      }
      html += '</tbody></table>';
      section.innerHTML = html;
      area.appendChild(section);
    }
  }

  /* ============== 完整导出 ============== */
  function buildAll(area, chapters) {
    area.innerHTML = `<h1 class="print-title">📚 完整复习资料</h1>`;
    for (const ch of chapters) {
      const section = document.createElement('div');
      section.className = 'print-chapter';
      let html = `<h2>${ch.name} ${'★'.repeat(ch.star)}</h2>`;

      // 考点
      if (ch.keypoints && ch.keypoints.length) {
        html += '<h3 class="print-section-title">📋 考点清单</h3>';
        for (const kp of ch.keypoints) {
          html += `<div class="print-kp"><h4>${'★'.repeat(kp.star||3)} ${esc(kp.title)}</h4>
            <div>${marked.parse(kp.body || '')}</div></div>`;
        }
      }

      // 公式
      if (ch.formulas && ch.formulas.length) {
        html += '<h3 class="print-section-title">📐 公式</h3>';
        for (const f of ch.formulas) {
          html += `<div class="print-formula-item"><strong>${esc(f.name||'')}</strong>：${f.formula||''}</div>`;
          if (f.condition) html += `<div class="print-fcond-inline">条件：${esc(f.condition)}</div>`;
        }
      }

      // 例题
      if (ch.examples && ch.examples.length) {
        html += '<h3 class="print-section-title">📝 例题精讲</h3>';
        for (const ex of ch.examples) {
          html += `<div class="print-example"><h4>${esc(ex.title)}</h4>
            <div>${marked.parse(ex.body || '')}</div></div>`;
        }
      }

      // 真题映射
      if (ch.examMapping && ch.examMapping.trim()) {
        html += '<h3 class="print-section-title">🎯 真题映射</h3>';
        html += `<div>${marked.parse(ch.examMapping)}</div>`;
      }

      section.innerHTML = html;
      area.appendChild(section);
    }
  }

  /* ============== 工具 ============== */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

  global.PrintView = PrintView;
})(window);
