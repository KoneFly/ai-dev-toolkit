/* ==============================================================
 * views/read.js - 阅读视图协调器（知识总览 + 公式速查）
 * 管理 #view-read（考点+题库）和 #view-formula（公式速查）两个子面板
 * ============================================================== */

(function (global) {
  'use strict';

  const ReadView = {};
  let currentSubView = 'knowledge'; // 'knowledge' | 'formula'

  ReadView.render = function (chId) {
    if (currentSubView === 'formula') {
      showFormula();
    } else {
      showKnowledge(chId);
    }
  };

  function showKnowledge(chId) {
    currentSubView = 'knowledge';
    document.getElementById('view-read').style.display = '';
    document.getElementById('view-formula').style.display = 'none';
    if (global.KnowledgeView) KnowledgeView.render(chId);
    syncTabHighlight();
  }

  function showFormula() {
    currentSubView = 'formula';
    document.getElementById('view-read').style.display = 'none';
    // formula section 需要 active 类让 display 生效
    const formulaEl = document.getElementById('view-formula');
    formulaEl.style.display = 'block';
    if (global.FormulaView) FormulaView.render();
    syncTabHighlight();
  }

  function syncTabHighlight() {
    // read 视图内的 tab 高亮
    document.querySelectorAll('#knowledge-tabs button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === (currentSubView === 'formula' ? 'formula' : getKnowledgeTab()));
    });
    // formula 视图内的 tab 导航也同步
    document.querySelectorAll('#knowledge-tabs-formula button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === (currentSubView === 'formula' ? 'formula' : getKnowledgeTab()));
    });
  }

  function getKnowledgeTab() {
    // 读 knowledge.js 的当前 tab（可能是 keypoints 或 questions）
    const activeBtn = document.querySelector('#knowledge-tabs button.active');
    return activeBtn ? activeBtn.dataset.tab : 'keypoints';
  }

  ReadView.switchToFormula = function () {
    showFormula();
  };

  ReadView.switchToKnowledge = function (tab) {
    currentSubView = 'knowledge';
    showKnowledge();
    if (tab) {
      const btn = document.querySelector(`#knowledge-tabs button[data-tab="${tab}"]`);
      if (btn) btn.click();
    }
  };

  /* ============== 绑定 ============== */
  ReadView.bind = function () {
    // read 视图内 formula tab 按钮
    document.querySelectorAll('#knowledge-tabs button[data-tab="formula"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        showFormula();
      };
    });

    // formula 视图内 tab 导航（切回考点/题库）
    document.querySelectorAll('#knowledge-tabs-formula button').forEach(btn => {
      if (btn.dataset.tab === 'formula') return; // 已在公式视图，不需要再切
      btn.onclick = (e) => {
        e.stopPropagation();
        ReadView.switchToKnowledge(btn.dataset.tab);
      };
    });
  };

  global.ReadView = ReadView;
})(window);
