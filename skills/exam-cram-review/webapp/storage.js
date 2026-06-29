/* ==============================================================
 * storage.js - LocalStorage 数据持久化
 * 保存：每章题目正确率、错题列表、最后练习时间、章节缓存
 * ============================================================== */

(function (global) {
  'use strict';

  const NS = 'exam-cram-review.v1';
  const Storage = {};

  /**
   * {
   *   chapters: {...},             // 解析后的章节数据缓存
   *   vaultName: 'ai复习',
   *   mastery: {                   // 每章每题答对/答错
   *     '01': { 'q-0': 'right', 'q-1': 'wrong', ... },
   *     '04': {...}
   *   },
   *   mistakes: [{chId, qIdx, title, ts}], // 错题时间线（最近100条）
   *   lastView: 'dashboard',
   *   chapterColors: {}            // 节点位置缓存（地图视图记忆）
   * }
   */

  Storage.load = function () {
    try {
      const raw = localStorage.getItem(NS);
      if (!raw) return defaultState();
      const obj = JSON.parse(raw);
      return Object.assign(defaultState(), obj);
    } catch (e) {
      return defaultState();
    }
  };

  Storage.save = function (state) {
    try {
      localStorage.setItem(NS, JSON.stringify(state));
    } catch (e) {
      console.warn('Storage quota exceeded', e);
    }
  };

  Storage.clear = function () {
    localStorage.removeItem(NS);
  };

  function defaultState() {
    return {
      vaultName: '',
      chapters: null,           // 解析后的章节数据
      mastery: {},
      mistakes: [],
      lastView: 'dashboard',
      mapPositions: {},
      formulaMastery: {},       // 公式背诵掌握度
      aiQuestionBank: {}        // AI 生成题库：{ chId: { questions: [...] } }
    };
  }

  /* ============== 业务方法 ============== */

  /**
   * 记录公式的答题结果
   */
  Storage.recordFormulaAnswer = function (state, chId, formulaName, judge) {
    if (!state.formulaMastery) state.formulaMastery = {};
    if (!state.formulaMastery[chId]) state.formulaMastery[chId] = {};
    state.formulaMastery[chId][formulaName] = judge;
  };

  /**
   * 记录一题的答题结果
   */
  Storage.recordAnswer = function (state, chId, qIdx, qTitle, judge) {
    if (!state.mastery[chId]) state.mastery[chId] = {};
    state.mastery[chId][`q-${qIdx}`] = judge;
    if (judge === 'wrong') {
      state.mistakes.unshift({
        chId,
        qIdx,
        title: qTitle,
        ts: Date.now()
      });
      // 同章同题去重，保留最新
      const seen = new Set();
      state.mistakes = state.mistakes.filter(m => {
        const key = `${m.chId}-${m.qIdx}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 100);
    } else if (judge === 'right') {
      // 答对了从错题表里移除
      state.mistakes = state.mistakes.filter(
        m => !(m.chId === chId && m.qIdx === qIdx)
      );
    }
  };

  /**
   * 计算章节掌握度
   * @returns {{total, right, wrong, untouched, rate, level}}
   *   level: 'green' | 'yellow' | 'red' | 'gray'
   */
  Storage.computeMastery = function (state, chapter) {
    const total = chapter.quizQuestions.length;
    const m = state.mastery[chapter.id] || {};
    let right = 0, wrong = 0;
    for (const k in m) {
      if (m[k] === 'right') right++;
      else if (m[k] === 'wrong') wrong++;
    }
    const touched = right + wrong;
    const untouched = total - touched;
    const rate = touched > 0 ? right / touched : 0;
    let level;
    if (touched === 0) level = 'gray';
    else if (rate >= 0.85) level = 'green';
    else if (rate >= 0.60) level = 'yellow';
    else level = 'red';
    return { total, right, wrong, untouched, rate, level };
  };

  /**
   * 全局统计
   */
  Storage.computeGlobalStats = function (state, chapters) {
    const list = Object.values(chapters);
    const totalQ = list.reduce((s, c) => s + c.quizQuestions.length, 0);
    let totalRight = 0, totalTouched = 0;
    let weakest = null;
    for (const c of list) {
      const m = Storage.computeMastery(state, c);
      totalRight += m.right;
      totalTouched += m.right + m.wrong;
      if (m.level === 'red' && (!weakest || m.rate < weakest.rate)) {
        weakest = { name: c.name, rate: m.rate };
      }
    }
    const correctRate = totalTouched > 0 ? Math.round(100 * totalRight / totalTouched) : 0;
    return {
      chapterCount: list.length,
      questionCount: totalQ,
      correctRate,
      weakest: weakest ? weakest.name : '暂无',
      progressTouched: totalTouched,
      progressTotal: totalQ
    };
  };

  global.AppStorage = Storage;
})(window);
