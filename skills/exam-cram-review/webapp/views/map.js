/* ==============================================================
 * views/map.js - 可视化知识地图（Cytoscape.js）
 * 节点颜色按掌握度（green/yellow/red/gray）
 * 节点大小按重要性星级
 * ============================================================== */

(function (global) {
  'use strict';

  const MapView = {};
  let cy = null;

  MapView.render = function () {
    const chapters = App.state.chapters;
    if (!chapters) return;

    const elements = [];

    // 节点：每个章节
    for (const id in chapters) {
      const c = chapters[id];
      const m = AppStorage.computeMastery(App.state, c);
      elements.push({
        data: {
          id: c.id,
          label: c.name,
          rate: Math.round(m.rate * 100),
          touched: m.right + m.wrong,
          total: m.total,
          star: c.star,
          level: m.level
        }
      });
    }

    // 边：章节依赖
    for (const id in chapters) {
      const c = chapters[id];
      for (const dep of c.deps) {
        elements.push({
          data: { id: `${id}-${dep}`, source: dep, target: id }
        });
      }
    }

    if (cy) cy.destroy();

    cy = cytoscape({
      container: document.getElementById('cy-container'),
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': nodeColor,
            'border-color': '#3a3a3a',
            'border-width': 2,
            'label': nodeLabel,
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'font-size': '13px',
            'font-weight': '600',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'width': nodeSize,
            'height': nodeSize,
            'shape': 'round-rectangle',
            'padding': '12px'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#bbb',
            'target-arrow-color': '#bbb',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.2
          }
        },
        {
          selector: 'node:selected',
          style: { 'border-color': '#b45309', 'border-width': 4 }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 40,
        spacingFactor: 1.4,
        animate: true,
        animationDuration: 400
      },
      wheelSensitivity: 0.15,
      minZoom: 0.5,
      maxZoom: 2.5
    });

    cy.on('tap', 'node', evt => {
      const chId = evt.target.id();
      App.openQuizForChapter(chId);
    });

    cy.on('mouseover', 'node', evt => {
      const d = evt.target.data();
      App.showToast(`${d.label} · ${d.rate}% (${d.touched}/${d.total}题)`);
    });
  };

  MapView.fit = function () {
    if (cy) cy.fit(null, 50);
  };

  function nodeColor(ele) {
    const lv = ele.data('level');
    return { green: '#15803d', yellow: '#ca8a04', red: '#b91c1c', gray: '#94a3b8' }[lv];
  }

  function nodeSize(ele) {
    const star = ele.data('star') || 3;
    return 60 + star * 12;   // ★3 → 96, ★5 → 120
  }

  function nodeLabel(ele) {
    const d = ele.data();
    return `${d.label}\n${d.rate}%`;
  }

  global.MapView = MapView;
})(window);
