/* ==============================================================
 * editor.js - 跳转本地 MD 编辑器
 * 解耦阅读端：让用户选择任意 MD 编辑器（不绑定 Obsidian）
 *
 * 浏览器安全限制：
 *   - 无法直接打开 file:// 链接（CORS）
 *   - 无法拿到 File API 的绝对路径
 *   - 但可以通过协议 URL 触发本地应用
 *
 * 解决方案：
 *   - 用户首次配置「Vault 绝对路径 + 首选编辑器」
 *   - 文件相对路径已在 parser 中保存
 *   - 拼接成对应编辑器的协议 URL 触发跳转
 *
 * 支持编辑器：
 *   - Obsidian:  obsidian://open?vault=<name>&file=<relpath>
 *   - VS Code:   vscode://file/<absolute_path>
 *   - Typora:    typora-open://<absolute_path>
 *   - MarkText:  marktext://<absolute_path>
 *   - 资源管理器: 复制路径到剪贴板（浏览器无法直接打开）
 *   - 仅复制路径
 * ============================================================== */

(function (global) {
  'use strict';

  const Editor = {};
  const SETTINGS_KEY = 'exam-cram-review.editor.v1';

  /**
   * Settings 结构：
   * {
   *   editor: 'obsidian' | 'vscode' | 'typora' | 'marktext' | 'explorer' | 'clipboard',
   *   vaultPath: 'C:\\Users\\KoneFly\\Desktop\\学习\\模集',  // 绝对路径
   *   obsidianVaultName: '模集'  // 仅 Obsidian 需要
   * }
   */
  Editor.loadSettings = function () {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || defaultSettings();
    } catch (e) {
      return defaultSettings();
    }
  };

  Editor.saveSettings = function (s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  };

  function defaultSettings() {
    return {
      editor: 'clipboard',
      vaultPath: '',
      obsidianVaultName: ''
    };
  }

  /**
   * 生成跳转到指定 MD 文件的 URL，并触发打开
   * @param {string} relPath - 文件相对路径（已去掉 vault 顶层），如 "01_第1章/01_考点清单.md"
   * @returns {Promise<{ok: boolean, action: string, payload?: string}>}
   */
  Editor.openFile = async function (relPath) {
    const s = Editor.loadSettings();

    // 没配置过 → 弹窗让用户配置
    if (!s.vaultPath && s.editor !== 'clipboard') {
      const ok = await Editor.showSettingsDialog();
      if (!ok) return { ok: false, action: 'canceled' };
      return Editor.openFile(relPath);
    }

    const absPath = joinPath(s.vaultPath, relPath);

    switch (s.editor) {
      case 'obsidian': {
        const vaultName = s.obsidianVaultName || inferVaultName(s.vaultPath);
        // obsidian://open?vault=xxx&file=relpath（不含 .md 后缀也可）
        const url = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath)}`;
        triggerProtocol(url);
        return { ok: true, action: 'opened', payload: url };
      }
      case 'vscode': {
        // vscode://file/绝对路径（Windows 路径反斜杠转正斜杠）
        const url = `vscode://file/${absPath.replace(/\\/g, '/')}`;
        triggerProtocol(url);
        return { ok: true, action: 'opened', payload: url };
      }
      case 'typora': {
        const url = `typora-open://${absPath.replace(/\\/g, '/')}`;
        triggerProtocol(url);
        return { ok: true, action: 'opened', payload: url };
      }
      case 'marktext': {
        const url = `marktext://${absPath.replace(/\\/g, '/')}`;
        triggerProtocol(url);
        return { ok: true, action: 'opened', payload: url };
      }
      case 'explorer':
      case 'clipboard':
      default: {
        await copyToClipboard(absPath);
        return { ok: true, action: 'copied', payload: absPath };
      }
    }
  };

  /**
   * 弹出设置对话框
   * @returns {Promise<boolean>} - 用户是否完成配置
   */
  Editor.showSettingsDialog = function () {
    return new Promise(resolve => {
      const s = Editor.loadSettings();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-card">
          <div class="modal-header">
            <h3>编辑器配置</h3>
            <button class="modal-close" type="button">×</button>
          </div>
          <div class="modal-body">
            <p class="modal-hint">配置一次后，所有"在编辑器中打开"按钮会用此设置。</p>

            <div class="form-row">
              <label>首选编辑器</label>
              <select id="ed-editor">
                <option value="obsidian"${s.editor==='obsidian'?' selected':''}>Obsidian</option>
                <option value="vscode"${s.editor==='vscode'?' selected':''}>VS Code</option>
                <option value="typora"${s.editor==='typora'?' selected':''}>Typora</option>
                <option value="marktext"${s.editor==='marktext'?' selected':''}>MarkText</option>
                <option value="clipboard"${s.editor==='clipboard'?' selected':''}>仅复制路径（手动打开）</option>
              </select>
            </div>

            <div class="form-row" id="ed-vault-row">
              <label>Vault 绝对路径</label>
              <input type="text" id="ed-vault" value="${escapeAttr(s.vaultPath)}"
                placeholder="例：C:\\Users\\YourName\\Desktop\\课程名">
              <div class="form-hint">浏览器无法自动获取，请手动填写复习目录所在的绝对路径</div>
            </div>

            <div class="form-row" id="ed-obsidian-row" style="display:none">
              <label>Obsidian Vault 名称</label>
              <input type="text" id="ed-obs-name" value="${escapeAttr(s.obsidianVaultName)}"
                placeholder="留空则自动用目录名">
              <div class="form-hint">Obsidian 中的 Vault 名（左侧栏显示的那个）</div>
            </div>

            <div class="form-row">
              <div class="protocol-help" id="ed-protocol-help"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="ghost" id="ed-cancel">取消</button>
            <button class="primary" id="ed-save">保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const editorSel = overlay.querySelector('#ed-editor');
      const obsRow = overlay.querySelector('#ed-obsidian-row');
      const vaultRow = overlay.querySelector('#ed-vault-row');
      const helpEl = overlay.querySelector('#ed-protocol-help');

      const updateUI = () => {
        const ed = editorSel.value;
        obsRow.style.display = ed === 'obsidian' ? '' : 'none';
        vaultRow.style.display = ed === 'clipboard' ? 'none' : '';
        helpEl.innerHTML = PROTOCOL_HINTS[ed] || '';
      };
      editorSel.onchange = updateUI;
      updateUI();

      const close = (ok) => {
        document.body.removeChild(overlay);
        resolve(ok);
      };

      overlay.querySelector('.modal-close').onclick = () => close(false);
      overlay.querySelector('#ed-cancel').onclick = () => close(false);
      overlay.querySelector('#ed-save').onclick = () => {
        const newSettings = {
          editor: editorSel.value,
          vaultPath: overlay.querySelector('#ed-vault').value.trim(),
          obsidianVaultName: overlay.querySelector('#ed-obs-name').value.trim()
        };
        Editor.saveSettings(newSettings);
        close(true);
      };

      // 点击遮罩关闭
      overlay.onclick = e => { if (e.target === overlay) close(false); };
    });
  };

  /* ============== 工具函数 ============== */
  function joinPath(base, rel) {
    if (!base) return rel;
    // 统一用正斜杠中间存储，Windows 协议 URL 用正斜杠也接受
    const b = base.replace(/[\\/]+$/, '');
    const r = rel.replace(/^[\\/]+/, '');
    // 检测分隔符：若 base 含反斜杠则用反斜杠拼，否则正斜杠
    const sep = b.includes('\\') ? '\\' : '/';
    return b + sep + r.replace(/\//g, sep);
  }

  function inferVaultName(vaultPath) {
    return vaultPath.split(/[\\/]/).filter(Boolean).pop() || 'vault';
  }

  function triggerProtocol(url) {
    // 用隐藏 a 标签触发协议
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // 退化
      }
    }
    // 兜底
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return true;
  }

  function escapeAttr(s) {
    return String(s).replace(/["<>&]/g, c => ({
      '"': '&quot;', '<': '&lt;', '>': '&gt;', '&': '&amp;'
    }[c]));
  }

  const PROTOCOL_HINTS = {
    obsidian: '需要 Obsidian 已注册系统协议（默认安装即可）。Obsidian 中已添加该 Vault 才能跳转。',
    vscode: '需要 VS Code 已安装并注册 vscode:// 协议（默认安装即可）。',
    typora: '需要 Typora 已注册 typora-open:// 协议（macOS/Windows 默认注册；Linux 需手动）。',
    marktext: '需要 MarkText 已注册 marktext:// 协议（部分版本需手动配置）。',
    clipboard: '路径会复制到剪贴板，主人可粘贴到任意编辑器/资源管理器打开。'
  };

  global.Editor = Editor;
})(window);
