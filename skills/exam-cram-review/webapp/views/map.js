/* ==============================================================
 * views/map.js - 可视化知识地图（Canvas 卡片节点 + 拖动记忆 + 下钻展开 + 流动边）
 * ============================================================== */

(function (global) {
  'use strict';

  const MapView = {};
  let cy = null;
  let currentLayout = 'cose';
  const expandedChapters = new Set(); // 记录当前双击展开考点子图的章节 ID
  let flowInterval = null; // 用于 hover 连线跑马灯流动动画

  MapView.render = function () {
    const chapters = App.state.chapters;
    if (!chapters) return;

    // 清理之前的考点展开缓存
    expandedChapters.clear();
    stopFlowAnimation();

    const elements = buildElements(chapters);

    if (cy) cy.destroy();

    // 检查是否所有章节都具有已保存的坐标
    const hasPositions = Object.keys(chapters).every(id => 
      App.state.mapPositions && App.state.mapPositions[id]
    );

    const layoutOption = hasPositions && currentLayout === 'cose'
      ? { name: 'preset', positions: id => App.state.mapPositions[id] }
      : layoutConfig(currentLayout);

    cy = cytoscape({
      container: document.getElementById('cy-container'),
      elements,
      style: cyStyles(),
      layout: layoutOption,
      wheelSensitivity: 0.12,
      minZoom: 0.25,
      maxZoom: 2.5
    });

    // 注册 HTML 节点标签（cytoscape-node-html-label 插件）
    if (cy.nodeHtmlLabel) {
      cy.nodeHtmlLabel([
        {
          query: 'node[type = "chapter"]',
          halign: 'center',
          valign: 'center',
          halignBox: 'center',
          valignBox: 'center',
          tpl: renderChapterCard
        },
        {
          query: 'node[type = "keypoint"]',
          halign: 'center',
          valign: 'bottom',
          halignBox: 'center',
          valignBox: 'bottom',
          tpl: (data) => `<div class="cy-kp-label">${escapeHtml(data.label)}</div>`
        }
      ]);
    }

    bindEvents();
    renderPathBreadcrumb();
  };

  MapView.fit = function () {
    if (cy) cy.fit(null, 50);
  };

  MapView.setLayout = function (name) {
    currentLayout = name;
    document.getElementById('map-layout-cose').classList.toggle('active', name === 'cose');
    document.getElementById('map-layout-tree').classList.toggle('active', name === 'tree');
    
    if (cy) {
      // 切换布局时清理缓存的展开节点，避免混乱
      expandedChapters.clear();
      cy.remove('node[type = "keypoint"]');
      
      const layout = cy.layout(layoutConfig(name));
      layout.run();
    }
  };

  MapView.resetLayout = function () {
    if (confirm('确认重置布局？这将清除你保存的所有节点位置。')) {
      App.state.mapPositions = {};
      AppStorage.save(App.state);
      MapView.setLayout('cose');
    }
  };

  /* ============== 构建图元 ============== */
  function buildElements(chapters) {
    const elements = [];
    const recommendedSet = getRecommendedPathInfo(chapters);

    // 1. 节点
    for (const id in chapters) {
      const c = chapters[id];
      const m = AppStorage.computeMastery(App.state, c);
      elements.push({
        data: {
          id: c.id,
          label: c.name,
          star: c.star,
          rate: Math.round(m.rate * 100),
          touched: m.right + m.wrong,
          total: m.total,
          wrong: m.wrong,
          level: m.level,
          isHotspot: c.star >= 4,
          isRecommended: recommendedSet.nodes.has(c.id),
          type: 'chapter'
        }
      });
    }

    // 2. 依赖边
    for (const id in chapters) {
      const c = chapters[id];
      for (const dep of c.deps) {
        const edgeId = `${dep}-${id}`;
        // 边的类型从 parser 解析得到的 depTypes 里取，默认为 dependency
        const relationType = (c.depTypes && c.depTypes[dep]) || 'dependency';
        const isRec = recommendedSet.edges.has(edgeId);

        elements.push({
          data: {
            id: edgeId,
            source: dep,
            target: id,
            type: relationType,
            isRecommended: isRec
          }
        });
      }
    }
    return elements;
  }

  function shortLabel(name) {
    const m = name.match(/^第(\d+)章[ _]+(.+)$/);
    if (m) return `Ch${m[1]} ${m[2]}`;
    return name;
  }

  /* ============== 推荐路线算法 ============== */
  function getRecommendedPathInfo(chapters) {
    const recommendedNodes = new Set();
    const recommendedEdges = new Set();

    // 收集所有重要大题章节 (★ >= 4)
    const hotspots = Object.values(chapters).filter(c => c.star >= 4);

    // DFS 回溯依赖树
    function visit(chId) {
      if (recommendedNodes.has(chId)) return;
      recommendedNodes.add(chId);
      const c = chapters[chId];
      if (!c) return;
      for (const depId of c.deps) {
        if (chapters[depId]) {
          recommendedEdges.add(`${depId}-${chId}`);
          visit(depId);
        }
      }
    }

    hotspots.forEach(c => visit(c.id));

    return { nodes: recommendedNodes, edges: recommendedEdges };
  }

  function renderPathBreadcrumb() {
    // 渲染面包屑路径提示到副导航栏或控制面板顶部
    const chapters = App.state.chapters;
    if (!chapters) return;
    const recommended = getRecommendedPathInfo(chapters);
    const sortedIds = Array.from(recommended.nodes).sort((a, b) => parseInt(a) - parseInt(b));

    const existingTip = document.getElementById('map-recommend-route');
    if (existingTip) existingTip.remove();

    if (sortedIds.length === 0) return;

    const tip = document.createElement('div');
    tip.id = 'map-recommend-route';
    tip.style.cssText = `
      position: absolute;
      top: 70px;
      left: 20px;
      padding: 10px 18px;
      font-size: 13px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: calc(100% - 380px);
      flex-wrap: wrap;
    `;
    const crumbs = sortedIds.map(id => {
      const name = chapters[id] ? chapters[id].name.replace(/^第\d+章[ _]/, '') : id;
      return `<strong style="color:var(--ink-red);">Ch${id} ${name}</strong>`;
    }).join(' ➔ ');

    tip.innerHTML = `💡 <span style="color:var(--ink-soft)">必考通关路线：</span>${crumbs}`;
    document.querySelector('.map-shell').appendChild(tip);
  }

  /* ============== Cytoscape 样式映射（HTML 节点版） ============== */
  function cyStyles() {
    return [
      {
        selector: 'node[type = "chapter"]',
        style: {
          'shape': 'round-rectangle',
          // Canvas 节点设为透明，让 HTML 标签盖住
          'background-opacity': 0,
          'border-width': 0,
          'width': 180,
          'height': 110,
          'label': '',
          'overlay-opacity': 0
        }
      },
      {
        selector: 'node[type = "chapter"]:selected',
        style: {
          'overlay-color': '#b8423d',
          'overlay-opacity': 0.08
        }
      },
      // 考点子节点
      {
        selector: 'node[type = "keypoint"]',
        style: {
          'shape': 'ellipse',
          'background-color': '#9c8866',
          'border-color': '#fbf4dd',
          'border-width': 2,
          'label': '',
          'width': 36,
          'height': 36
        }
      },
      // 依赖边（手绘风）
      {
        selector: 'edge',
        style: {
          'width': ele => ele.data('isRecommended') ? 3 : 1.8,
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [20, -15],
          'control-point-weights': [0.3, 0.7],
          'arrow-scale': 1.1,
          'opacity': 0.65,
          'line-style': ele => ele.data('type') === 'tool' ? 'dashed' : 'solid',
          'line-dash-pattern': [6, 4],
          'transition-property': 'line-color, opacity, width',
          'transition-duration': '0.2s'
        }
      },
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': '#b8423d',
          'target-arrow-color': '#b8423d',
          'opacity': 1,
          'width': 3.5,
          'line-style': 'dashed',
          'line-dash-pattern': [8, 4]
        }
      },
      {
        selector: 'edge[type = "keypoint-link"]',
        style: {
          'width': 1.2,
          'line-color': '#9c8866',
          'line-style': 'dotted',
          'target-arrow-shape': 'none',
          'opacity': 0.5
        }
      },
      {
        selector: 'node.faded',
        style: { 'opacity': 0.2 }
      },
      {
        selector: 'edge.faded',
        style: { 'opacity': 0.06 }
      }
    ];
  }

  /* ============== HTML 索引卡渲染 ============== */
  function renderChapterCard(data) {
    const name = data.label || '';
    const m = name.match(/^第(\d+)章[ _]+(.+)$/);
    const chNum = m ? m[1] : data.id;
    const chTitle = m ? m[2] : name;
    const star = data.star || 3;
    const rate = data.rate || 0;
    const touched = data.touched || 0;
    const wrong = data.wrong || 0;
    const level = data.level || 'gray';
    const isHotspot = data.isHotspot;

    // 决定倾斜角度（基于章号制造伪随机的"贴歪了"效果）
    const tilts = [-1.2, 0.8, -0.6, 1.4, -1.0, 0.5, -0.8, 1.2, -0.4, 0.9];
    const tilt = tilts[parseInt(data.id, 10) % tilts.length];

    const starStr = '★'.repeat(star) + '<span style="opacity:0.3">★</span>'.repeat(5 - star);

    return `
      <div class="cy-card ${isHotspot ? 'hotspot' : ''}" style="--tilt:${tilt}deg;">
        <div class="cy-card-head">
          <span class="cy-card-id">Ch${chNum}</span>
          <span class="cy-card-star">${starStr}</span>
        </div>
        <div class="cy-card-title">${escapeHtml(chTitle)}</div>
        <div class="cy-card-bar">
          <div class="cy-card-bar-fill ${level}" style="width:${touched > 0 ? rate : 0}%;"></div>
        </div>
        <div class="cy-card-stat">
          <span>${touched > 0 ? rate + '%' : '未练习'}</span>
          ${wrong > 0 ? `<span class="wrong">✗ ${wrong}</span>` : '<span></span>'}
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function edgeColor(ele) {
    if (ele.data('isRecommended')) return '#b8423d'; // 推荐路径红墨水
    return '#9c8866';                                 // 默认褪色墨水
  }

  /* ============== 布局配置 ============== */
  function layoutConfig(name) {
    if (name === 'tree') {
      return {
        name: 'breadthfirst', directed: true, padding: 50,
        spacingFactor: 1.3, animate: true, animationDuration: 500
      };
    }
    return {
      name: 'cose',
      idealEdgeLength: 150,
      nodeOverlap: 40,
      refresh: 20,
      fit: true,
      padding: 50,
      randomize: true,
      componentSpacing: 110,
      nodeRepulsion: 600000,
      edgeElasticity: 80,
      nestingFactor: 6,
      gravity: 70,
      numIter: 1200,
      coolingFactor: 0.95,
      minTemp: 1.0,
      animate: true,
      animationDuration: 600
    };
  }

  /* ============== 关系边流动动画 ============== */
  function startFlowAnimation(edges) {
    stopFlowAnimation();
    let offset = 0;
    flowInterval = setInterval(() => {
      offset = (offset + 1) % 24;
      edges.style('line-dash-offset', -offset);
    }, 45);
  }

  function stopFlowAnimation() {
    if (flowInterval) {
      clearInterval(flowInterval);
      flowInterval = null;
    }
    if (cy) cy.edges().removeStyle('line-dash-offset');
  }

  /* ============== 交互事件绑定 ============== */
  function bindEvents() {
    let lastTap = 0;
    let lastTapNode = null;

    // 监听拖拽定位保存
    cy.on('free', 'node', evt => {
      const node = evt.target;
      if (node.data('type') !== 'chapter') return; // 仅保存章节节点坐标

      if (!App.state.mapPositions) App.state.mapPositions = {};
      App.state.mapPositions[node.id()] = node.position();
      AppStorage.save(App.state);
    });

    cy.on('tap', 'node', evt => {
      const node = evt.target;
      const now = Date.now();
      
      if (now - lastTap < 350 && lastTapNode === node) {
        // 双击交互 ➔ 展开/折叠考点子图
        toggleDrillDown(node);
      } else {
        // 单击交互 ➔ 显示详情并高亮关联
        if (node.data('type') === 'chapter') {
          showDetail(node);
          highlightNeighborhood(node);
        } else if (node.data('type') === 'keypoint') {
          // 单击考点节点：弹窗或详情高亮（这里高亮父级）
          const parentId = node.id().split('-kp-')[0];
          const parentNode = cy.getElementById(parentId);
          if (parentNode) {
            showDetail(parentNode);
            highlightNeighborhood(parentNode);
          }
        }
      }
      lastTap = now;
      lastTapNode = node;
    });

    cy.on('tap', evt => {
      if (evt.target === cy) {
        hideDetail();
        unhighlight();
      }
    });
  }

  function toggleDrillDown(node) {
    if (node.data('type') !== 'chapter') return;
    const chId = node.id();
    const ch = App.state.chapters[chId];
    if (!ch) return;

    if (expandedChapters.has(chId)) {
      // 1. 折叠
      expandedChapters.delete(chId);
      cy.remove(`node[id ^= "${chId}-kp-"]`);
    } else {
      // 2. 展开
      expandedChapters.add(chId);
      const center = node.position();
      const kps = ch.keypoints || [];
      const count = kps.length;
      const radius = 100; // 考点圈半径
      
      const elementsToAdd = [];
      kps.forEach((kp, i) => {
        const kpId = `${chId}-kp-${kp.number}`;
        const angle = (2 * Math.PI / count) * i;
        
        elementsToAdd.push({
          group: 'nodes',
          data: {
            id: kpId,
            label: kp.title,
            star: kp.star,
            type: 'keypoint'
          },
          position: {
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle)
          }
        });

        elementsToAdd.push({
          group: 'edges',
          data: {
            id: `${chId}-edge-${kpId}`,
            source: chId,
            target: kpId,
            type: 'keypoint-link'
          }
        });
      });

      cy.add(elementsToAdd);
    }
  }

  function highlightNeighborhood(node) {
    cy.elements().addClass('faded');
    
    // 自身以及相连的子考点
    const subNodes = cy.nodes(`[id ^= "${node.id()}-kp-"]`);
    const subEdges = cy.edges(`[id ^= "${node.id()}-edge-"]`);

    const nh = node.closedNeighborhood();
    nh.removeClass('faded');
    subNodes.removeClass('faded');
    subEdges.removeClass('faded');

    // 邻居连线高亮并触发跑马灯流动
    const activeEdges = nh.edgesWith(nh).filter('[type != "keypoint-link"]');
    activeEdges.addClass('highlighted');
    node.connectedEdges('[type != "keypoint-link"]').addClass('highlighted');

    const flowingEdges = cy.edges('.highlighted');
    if (flowingEdges.length > 0) {
      startFlowAnimation(flowingEdges);
    } else {
      stopFlowAnimation();
    }
  }

  function unhighlight() {
    stopFlowAnimation();
    cy.elements().removeClass('faded').removeClass('highlighted');
  }

  /* ============== 右侧详情面板 ============== */
  function showDetail(node) {
    const id = node.id();
    const ch = App.state.chapters[id];
    if (!ch) return;
    const m = AppStorage.computeMastery(App.state, ch);

    document.getElementById('detail-name').textContent = ch.name;
    const starEl = document.getElementById('detail-star');
    starEl.innerHTML = '★'.repeat(ch.star) + '<span style="opacity:0.3">' + '★'.repeat(5 - ch.star) + '</span>';
    if (ch.star >= 4) {
      starEl.innerHTML += '  <span style="color:var(--ink-red);font-size:12px;font-weight:700;margin-left:8px;border:1px solid var(--ink-red);padding:1px 6px;border-radius:3px;background:rgba(184,66,61,0.06);">🔥 必出大题</span>';
    }

    document.getElementById('detail-rate').innerHTML = m.touched > 0
      ? `<span style="color:var(--ink-${m.level === 'gray' ? 'fade' : (m.level === 'green' ? 'green' : m.level === 'yellow' ? 'yellow' : 'red')})">${Math.round(m.rate*100)}%</span>`
      : '<span style="color:var(--ink-fade)">未练习</span>';
    document.getElementById('detail-keypoints').textContent = ch.keypoints.length;
    document.getElementById('detail-formulas').textContent = ch.formulas.length;
    document.getElementById('detail-quiz').textContent = `${m.right + m.wrong}/${ch.quizQuestions.length}`;
    document.getElementById('detail-wrong').innerHTML = m.wrong > 0
      ? `<span style="color:var(--ink-red);font-weight:700;">${m.wrong}</span>` : '0';

    const ul = document.getElementById('detail-keypoints-list');
    ul.innerHTML = '';
    ch.keypoints.slice(0, 8).forEach(kp => {
      const li = document.createElement('li');
      const stars = '★'.repeat(kp.star || 3);
      li.innerHTML = `<span class="kp-star">${stars}</span> <span>${kp.title}</span>`;
      ul.appendChild(li);
    });

    document.getElementById('detail-go-quiz').onclick = () => App.openQuizForChapter(id);
    document.getElementById('detail-go-formula').onclick = () => {
      App.switchView('formula');
      setTimeout(() => {
        const sel = document.getElementById('formula-chapter-select');
        if (sel) { sel.value = id; sel.dispatchEvent(new Event('change')); }
      }, 100);
    };
    document.getElementById('detail-go-editor').onclick = () => App.openInEditor(id);

    document.getElementById('map-detail').classList.remove('hidden');
  }

  function hideDetail() {
    document.getElementById('map-detail').classList.add('hidden');
  }

  /* ============== 事件绑定 ============== */
  MapView.bind = function () {
    const closeBtn = document.getElementById('map-detail-close');
    if (closeBtn) closeBtn.onclick = () => { hideDetail(); unhighlight(); };
    
    const c = document.getElementById('map-layout-cose');
    const t = document.getElementById('map-layout-tree');
    const r = document.getElementById('map-layout-reset');
    
    if (c) c.onclick = () => MapView.setLayout('cose');
    if (t) t.onclick = () => MapView.setLayout('tree');
    if (r) r.onclick = MapView.resetLayout;
  };

  global.MapView = MapView;
})(window);
