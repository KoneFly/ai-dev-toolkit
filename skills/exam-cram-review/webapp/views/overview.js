/* ==============================================================
 * views/overview.js - 总览（仪表盘 + 知识地图 协调器）
 * 复用 DashboardView + MapView，不重写逻辑
 * ============================================================== */

(function (global) {
  'use strict';

  const OverviewView = {};

  OverviewView.render = function () {
    // 上半：统计卡 + 章节掌握度 + 最近错题
    if (global.DashboardView && DashboardView.render) DashboardView.render();
    // 下半：知识地图（Cytoscape 单例会 destroy/rebuild）
    if (global.MapView && MapView.render) MapView.render();
  };

  global.OverviewView = OverviewView;
})(window);
