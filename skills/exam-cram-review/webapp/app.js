/* ==============================================================
 * app.js - 应用入口与全局调度
 * ============================================================== */

const App = (function () {
  'use strict';

  const App = {
    state: AppStorage.load(),
    currentView: 'dashboard'
  };

  /* ============== 持久化 ============== */
  App.persist = function () {
    AppStorage.save(App.state);
    refreshProgress();
  };

  /* ============== Toast ============== */
  let toastTimer = null;
  App.showToast = function (msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  };

  /* ============== 视图切换 ============== */
  App.switchView = function (name) {
    App.currentView = name;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${name}`).classList.add('active');
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === name);
    });
    App.state.lastView = name;
    AppStorage.save(App.state);

    if (name === 'dashboard') DashboardView.render();
    else if (name === 'map') MapView.render();
    else if (name === 'quiz') QuizView.render();
    else if (name === 'formula') FormulaView.render();
    else if (name === 'ai') AIView.render();
  };

  /* ============== 跨视图跳转 ============== */
  App.openQuizForChapter = function (chId, qIdx) {
    App.switchView('quiz');
    QuizView.render(chId, qIdx);
  };

  /**
   * 在用户配置的编辑器中打开指定章节的 MD 文件
   * @param {string} chId - 章节 id
   * @param {string} fileName - 文件名（如 '01_考点清单.md'），不传则用 00_总索引
   */
  App.openInEditor = async function (chId, fileName) {
    const ch = chId ? App.state.chapters[chId] : null;
    let relPath;
    if (!ch) {
      relPath = '00_总索引.md';
    } else if (fileName && ch.files && ch.files[fileName]) {
      relPath = ch.files[fileName];
    } else if (ch.files && ch.files['01_考点清单.md']) {
      relPath = ch.files['01_考点清单.md'];
    } else {
      App.showToast('未找到对应文件');
      return;
    }
    const result = await Editor.openFile(relPath);
    if (result.action === 'opened') {
      App.showToast('已尝试打开编辑器');
    } else if (result.action === 'copied') {
      App.showToast('路径已复制到剪贴板');
    }
  };

  /* ============== 进度条 ============== */
  function refreshProgress() {
    if (!App.state.chapters) return;
    const stats = AppStorage.computeGlobalStats(App.state, App.state.chapters);
    document.getElementById('progress-text').textContent =
      `${stats.progressTouched} / ${stats.progressTotal}`;
    const pct = stats.progressTotal > 0
      ? (stats.progressTouched / stats.progressTotal) * 100
      : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
  }

  /* ============== 加载 ============== */
  App.loadFromFiles = async function (files) {
    App.showToast('解析中...');
    try {
      const { chapters } = await Parser.parseFromFiles(files);
      if (Object.keys(chapters).length === 0) {
        App.showToast('未识别到章节文件，请确认选择的是 ai复习/ 目录');
        return;
      }
      App.state.chapters = chapters;
      // 推断 vault 名称
      const first = files[0]?.webkitRelativePath || '';
      App.state.vaultName = first.split('/')[0] || 'ai复习';
      AppStorage.save(App.state);

      document.getElementById('vault-name').textContent =
        `· ${App.state.vaultName} · ${Object.keys(chapters).length}章`;
      document.getElementById('splash').classList.remove('active');
      App.switchView('dashboard');
      refreshProgress();
      App.showToast(`已加载 ${Object.keys(chapters).length} 个章节`);
    } catch (e) {
      console.error(e);
      App.showToast('加载失败：' + e.message);
    }
  };

  App.loadDemo = function () {
    // 内置最小示例数据
    App.state.chapters = {
      '01': {
        id: '01', slug: '01_第1章_示例', number: 1,
        name: '第1章 示例章节', star: 3,
        keypoints: [], examples: [],
        formulas: [
          { name: '欧姆定律', formula: '$$ V = I \\cdot R $$', condition: '线性元件', note: '基础公式' },
          { name: '功率', formula: '$$ P = V \\cdot I $$', condition: '直流电路', note: '' }
        ],
        quizQuestions: [
          { title: '自测 1', question: '一个 10Ω 电阻通过 2A 电流，两端电压是多少？', answer: '**V = IR = 2 × 10 = 20V**' },
          { title: '自测 2', question: '同样条件下功耗是多少？', answer: '**P = VI = 20 × 2 = 40W**' }
        ],
        examMapping: '', deps: []
      }
    };
    App.state.vaultName = '示例数据';
    document.getElementById('vault-name').textContent = '· 示例数据 · 1章';
    document.getElementById('splash').classList.remove('active');
    App.switchView('dashboard');
    refreshProgress();
  };

  /* ============== 启动 ============== */
  function init() {
    // 启动屏交互
    const dirPicker = document.getElementById('dir-picker');
    document.getElementById('pick-dir').onclick = () => dirPicker.click();
    dirPicker.onchange = e => App.loadFromFiles(Array.from(e.target.files));
    document.getElementById('load-demo').onclick = () => App.loadDemo();

    // 顶栏视图切换
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.onclick = () => App.switchView(btn.dataset.view);
    });

    // 顶栏编辑器配置按钮
    document.getElementById('editor-config').onclick = () => Editor.showSettingsDialog();

    // 顶栏换库按钮
    const swapInput = document.getElementById('swap-vault-input');
    document.getElementById('swap-vault').onclick = () => {
      if (App.state.chapters && confirm('换库会保留你的练习记录（按章节匹配）。继续？')) {
        swapInput.click();
      } else if (!App.state.chapters) {
        swapInput.click();
      }
    };
    swapInput.onchange = async e => {
      const oldMastery = App.state.mastery;
      const oldMistakes = App.state.mistakes;
      await App.loadFromFiles(Array.from(e.target.files));
      // 保留旧的掌握度数据（按章节 id 匹配）
      App.state.mastery = oldMastery || {};
      App.state.mistakes = oldMistakes || [];
      App.persist();
      App.switchView(App.currentView);
      swapInput.value = '';
    };

    // 各视图绑定
    if (QuizView.bind) QuizView.bind();
    if (FormulaView.bind) FormulaView.bind();
    if (MapView.bind) MapView.bind();
    if (AIView.bind) AIView.bind();
    document.getElementById('map-fit').onclick = () => MapView.fit();

    // 如果有缓存的章节数据，跳过启动屏
    if (App.state.chapters && Object.keys(App.state.chapters).length > 0) {
      document.getElementById('vault-name').textContent =
        `· ${App.state.vaultName} · ${Object.keys(App.state.chapters).length}章`;
      document.getElementById('splash').classList.remove('active');
      App.switchView(App.state.lastView || 'dashboard');
      refreshProgress();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return App;
})();
