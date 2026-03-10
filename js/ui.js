// ===== UI Module =====

const UI = {
  // ---- Toast Notifications ----
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  },

  // ---- Modal System ----
  showModal(title, bodyHtml, buttons) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;

    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    if (buttons) {
      buttons.forEach(btn => {
        const el = document.createElement('button');
        el.className = `btn ${btn.primary ? 'btn-primary' : ''}`;
        el.textContent = btn.label;
        el.onclick = () => {
          if (btn.onClick) btn.onClick();
          if (btn.close !== false) this.closeModal();
        };
        footer.appendChild(el);
      });
    }

    overlay.style.display = 'flex';
    // Focus first input
    setTimeout(() => {
      const input = modal.querySelector('input:not([type="hidden"])');
      if (input) input.focus();
    }, 50);
  },

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

  // ---- Prompt Modal (returns promise) ----
  prompt(title, label, defaultValue) {
    return new Promise(resolve => {
      const id = 'prompt-input-' + Date.now();
      this.showModal(title,
        `<div class="form-group">
          <label>${label}</label>
          <input type="text" id="${id}" value="${defaultValue || ''}" style="width:100%">
        </div>`,
        [
          { label: 'Cancel', onClick: () => resolve(null) },
          { label: 'OK', primary: true, onClick: () => {
            resolve(document.getElementById(id).value);
          }}
        ]
      );
      // Enter key submits
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            resolve(input.value);
            this.closeModal();
          }
        });
      }
    });
  },

  // ---- Confirm Modal ----
  confirm(title, message) {
    return new Promise(resolve => {
      this.showModal(title,
        `<p style="font-size:13px;color:var(--text-secondary)">${message}</p>`,
        [
          { label: 'Cancel', onClick: () => resolve(false) },
          { label: 'Confirm', primary: true, onClick: () => resolve(true) }
        ]
      );
    });
  },

  // ---- Context Menu ----
  showContextMenu(x, y, items) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = '';
    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-sep';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.className = `context-menu-item${item.danger ? ' danger' : ''}`;
      el.textContent = item.label;
      el.onclick = () => {
        this.hideContextMenu();
        if (item.onClick) item.onClick();
      };
      menu.appendChild(el);
    });
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';

    // Adjust if out of viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
  },

  hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
  },

  // ---- Key-Value Editor ----
  renderKVEditor(containerId, items, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'kv-header';
    header.innerHTML = `
      <span class="kv-check-head"></span>
      <span>Key</span>
      <span>Value</span>
      <span>Description</span>
      <span class="kv-delete-head"></span>
    `;
    container.appendChild(header);

    // Ensure at least one empty row
    if (!items || items.length === 0) {
      items = [{ key: '', value: '', description: '', enabled: true }];
    }

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'kv-row';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'kv-check';
      check.checked = item.enabled !== false;
      check.onchange = () => {
        items[idx].enabled = check.checked;
        onChange(items);
      };

      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.className = 'kv-key';
      keyInput.placeholder = 'Key';
      keyInput.value = item.key || '';
      keyInput.oninput = () => {
        items[idx].key = keyInput.value;
        onChange(items);
        maybeAddRow();
      };

      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.className = 'kv-value';
      valInput.placeholder = 'Value';
      valInput.value = item.value || '';
      valInput.oninput = () => {
        items[idx].value = valInput.value;
        onChange(items);
        maybeAddRow();
      };

      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.className = 'kv-desc';
      descInput.placeholder = 'Description';
      descInput.value = item.description || '';
      descInput.oninput = () => {
        items[idx].description = descInput.value;
        onChange(items);
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'kv-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.onclick = () => {
        if (items.length > 1) {
          items.splice(idx, 1);
          onChange(items);
          this.renderKVEditor(containerId, items, onChange);
        }
      };

      row.append(check, keyInput, valInput, descInput, deleteBtn);
      container.appendChild(row);
    });

    const maybeAddRow = () => {
      const last = items[items.length - 1];
      if (last && (last.key || last.value)) {
        items.push({ key: '', value: '', description: '', enabled: true });
        this.renderKVEditor(containerId, items, onChange);
      }
    };
  },

  // ---- JSON Pretty Print with syntax highlighting ----
  prettyPrintJson(str) {
    try {
      const obj = JSON.parse(str);
      const formatted = JSON.stringify(obj, null, 2);
      return this.syntaxHighlightJson(formatted);
    } catch {
      return this.escapeHtml(str);
    }
  },

  syntaxHighlightJson(json) {
    return json.replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ---- Format bytes ----
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  // ---- Format time ago ----
  timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  },

  // ---- Render Collections Tree ----
  renderCollections(collections) {
    const tree = document.getElementById('collections-tree');
    tree.innerHTML = '';

    if (collections.length === 0) {
      tree.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <p>No collections yet</p>
        </div>`;
      return;
    }

    collections.forEach(col => {
      const colEl = this._createCollectionNode(col);
      tree.appendChild(colEl);
    });
  },

  _createCollectionNode(col) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-collection-wrapper';

    // Collection header
    const item = document.createElement('div');
    item.className = 'tree-item tree-collection';
    item.dataset.collectionId = col.id;

    const collapseState = Storage.getSetting(`col_${col.id}_collapsed`);
    const isCollapsed = collapseState === true;

    item.innerHTML = `
      <span class="tree-icon">${isCollapsed ? '&#9654;' : '&#9660;'}</span>
      <span class="tree-label">${this.escapeHtml(col.name)}</span>
      <span class="tree-actions">
        <button class="tree-action-btn" data-action="add-request" title="Add Request">+</button>
        <button class="tree-action-btn" data-action="more" title="More">&#8943;</button>
      </span>
    `;

    // Click to expand/collapse
    item.querySelector('.tree-icon').onclick = (e) => {
      e.stopPropagation();
      const children = wrapper.querySelector('.tree-children');
      if (children) {
        children.classList.toggle('collapsed');
        const collapsed = children.classList.contains('collapsed');
        Storage.setSetting(`col_${col.id}_collapsed`, collapsed);
        item.querySelector('.tree-icon').innerHTML = collapsed ? '&#9654;' : '&#9660;';
      }
    };

    // Add request button
    item.querySelector('[data-action="add-request"]').onclick = (e) => {
      e.stopPropagation();
      App.newTab();
      App.setActiveCollectionForSave(col.id, null);
    };

    // More button (context menu)
    item.querySelector('[data-action="more"]').onclick = (e) => {
      e.stopPropagation();
      const rect = e.target.getBoundingClientRect();
      UI.showContextMenu(rect.right, rect.bottom, [
        { label: 'Add Folder', onClick: () => App.addFolder(col.id) },
        { label: 'Rename', onClick: () => App.renameCollection(col.id) },
        { label: 'Export', onClick: () => App.exportCollection(col.id) },
        { separator: true },
        { label: 'Delete', danger: true, onClick: () => App.deleteCollection(col.id) }
      ]);
    };

    // Right-click
    item.oncontextmenu = (e) => {
      e.preventDefault();
      UI.showContextMenu(e.clientX, e.clientY, [
        { label: 'Add Request', onClick: () => { App.newTab(); App.setActiveCollectionForSave(col.id, null); } },
        { label: 'Add Folder', onClick: () => App.addFolder(col.id) },
        { label: 'Rename', onClick: () => App.renameCollection(col.id) },
        { label: 'Export', onClick: () => App.exportCollection(col.id) },
        { separator: true },
        { label: 'Delete', danger: true, onClick: () => App.deleteCollection(col.id) }
      ]);
    };

    wrapper.appendChild(item);

    // Children
    const children = document.createElement('div');
    children.className = `tree-children${isCollapsed ? ' collapsed' : ''}`;

    if (col.items && col.items.length > 0) {
      col.items.forEach(child => {
        if (child.type === 'folder') {
          children.appendChild(this._createFolderNode(col.id, child));
        } else if (child.type === 'request') {
          const req = Collections.getRequest(child.id);
          if (req) {
            children.appendChild(this._createRequestNode(col.id, null, req));
          }
        }
      });
    }

    wrapper.appendChild(children);
    return wrapper;
  },

  _createFolderNode(collectionId, folder) {
    const wrapper = document.createElement('div');

    const item = document.createElement('div');
    item.className = 'tree-item tree-folder';
    item.dataset.folderId = folder.id;

    const collapseState = Storage.getSetting(`fld_${folder.id}_collapsed`);
    const isCollapsed = collapseState === true;

    item.innerHTML = `
      <span class="tree-icon">${isCollapsed ? '&#9654;' : '&#9660;'}</span>
      <span class="tree-label">${this.escapeHtml(folder.name)}</span>
      <span class="tree-actions">
        <button class="tree-action-btn" data-action="more" title="More">&#8943;</button>
      </span>
    `;

    item.querySelector('.tree-icon').onclick = (e) => {
      e.stopPropagation();
      const children = wrapper.querySelector('.tree-children');
      if (children) {
        children.classList.toggle('collapsed');
        const collapsed = children.classList.contains('collapsed');
        Storage.setSetting(`fld_${folder.id}_collapsed`, collapsed);
        item.querySelector('.tree-icon').innerHTML = collapsed ? '&#9654;' : '&#9660;';
      }
    };

    item.querySelector('[data-action="more"]').onclick = (e) => {
      e.stopPropagation();
      const rect = e.target.getBoundingClientRect();
      UI.showContextMenu(rect.right, rect.bottom, [
        { label: 'Rename', onClick: () => App.renameFolder(collectionId, folder.id) },
        { separator: true },
        { label: 'Delete', danger: true, onClick: () => App.deleteFolder(collectionId, folder.id) }
      ]);
    };

    wrapper.appendChild(item);

    const children = document.createElement('div');
    children.className = `tree-children${isCollapsed ? ' collapsed' : ''}`;

    if (folder.items && folder.items.length > 0) {
      folder.items.forEach(child => {
        if (child.type === 'request') {
          const req = Collections.getRequest(child.id);
          if (req) {
            children.appendChild(this._createRequestNode(collectionId, folder.id, req, true));
          }
        }
      });
    }

    wrapper.appendChild(children);
    return wrapper;
  },

  _createRequestNode(collectionId, folderId, req, nested) {
    const item = document.createElement('div');
    item.className = `tree-item ${nested ? 'tree-request-nested' : 'tree-request'}`;
    item.dataset.requestId = req.id;

    item.innerHTML = `
      <span class="tree-method method-${req.method}">${req.method}</span>
      <span class="tree-label">${this.escapeHtml(req.name || 'Untitled')}</span>
      <span class="tree-actions">
        <button class="tree-action-btn" data-action="more" title="More">&#8943;</button>
      </span>
    `;

    item.onclick = (e) => {
      if (e.target.closest('.tree-actions')) return;
      App.openRequest(req.id);
    };

    item.querySelector('[data-action="more"]').onclick = (e) => {
      e.stopPropagation();
      const rect = e.target.getBoundingClientRect();
      UI.showContextMenu(rect.right, rect.bottom, [
        { label: 'Open in New Tab', onClick: () => App.openRequest(req.id) },
        { label: 'Rename', onClick: () => App.renameRequest(collectionId, req.id) },
        { label: 'Duplicate', onClick: () => App.duplicateRequest(collectionId, req.id, folderId) },
        { separator: true },
        { label: 'Delete', danger: true, onClick: () => App.deleteRequest(collectionId, req.id) }
      ]);
    };

    item.oncontextmenu = (e) => {
      e.preventDefault();
      UI.showContextMenu(e.clientX, e.clientY, [
        { label: 'Open in New Tab', onClick: () => App.openRequest(req.id) },
        { label: 'Rename', onClick: () => App.renameRequest(collectionId, req.id) },
        { label: 'Duplicate', onClick: () => App.duplicateRequest(collectionId, req.id, folderId) },
        { separator: true },
        { label: 'Delete', danger: true, onClick: () => App.deleteRequest(collectionId, req.id) }
      ]);
    };

    return item;
  },

  // ---- Render History ----
  renderHistory(entries) {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No history yet</p>
        </div>`;
      return;
    }

    entries.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const method = entry.request.method || 'GET';
      const url = entry.request.url || '';
      // Show just the path for readability
      let displayUrl = url;
      try { displayUrl = new URL(url).pathname + new URL(url).search; } catch {}

      item.innerHTML = `
        <span class="history-method method-${method}">${method}</span>
        <span class="history-url" title="${this.escapeHtml(url)}">${this.escapeHtml(displayUrl || url)}</span>
        <span class="history-time">${this.timeAgo(entry.timestamp)}</span>
        <button class="history-delete" title="Delete">&times;</button>
      `;

      item.onclick = (e) => {
        if (e.target.classList.contains('history-delete')) {
          History.delete(entry.id);
          this.renderHistory(History.getAll());
          return;
        }
        App.openFromHistory(entry);
      };

      list.appendChild(item);
    });
  },

  // ---- Render Tabs ----
  renderTabs(tabs, activeTabId) {
    const scroll = document.getElementById('tabs-scroll');
    scroll.innerHTML = '';

    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `tab${tab.id === activeTabId ? ' active' : ''}${tab.isDirty ? ' dirty' : ''}`;
      el.dataset.tabId = tab.id;

      const method = tab.request ? tab.request.method : 'GET';

      el.innerHTML = `
        <span class="tab-method method-${method}">${method}</span>
        <span class="tab-name">${this.escapeHtml(tab.name || 'Untitled')}</span>
        <span class="tab-dot"></span>
        <span class="tab-close">&times;</span>
      `;

      el.onclick = (e) => {
        if (e.target.classList.contains('tab-close')) {
          App.closeTab(tab.id);
          return;
        }
        App.switchTab(tab.id);
      };

      // Middle-click to close
      el.onauxclick = (e) => {
        if (e.button === 1) App.closeTab(tab.id);
      };

      scroll.appendChild(el);
    });

    // Add tab button
    const addBtn = document.createElement('button');
    addBtn.className = 'tab-add';
    addBtn.innerHTML = '+';
    addBtn.onclick = () => App.newTab();
    scroll.appendChild(addBtn);
  },

  // ---- Render Response ----
  renderResponse(response) {
    const placeholder = document.getElementById('response-placeholder');
    const content = document.getElementById('response-content');
    const errorEl = document.getElementById('response-error');

    placeholder.style.display = 'none';
    errorEl.style.display = 'none';
    content.style.display = 'flex';

    // Status
    const statusEl = document.getElementById('response-status');
    const statusClass = response.status < 300 ? 'status-2xx' :
                        response.status < 400 ? 'status-3xx' :
                        response.status < 500 ? 'status-4xx' : 'status-5xx';
    statusEl.className = `response-status ${statusClass}`;
    statusEl.textContent = `${response.status} ${response.statusText}`;

    // Time & Size
    document.getElementById('response-time').textContent = `${response.time} ms`;
    document.getElementById('response-size').textContent = this.formatBytes(response.size);

    // Body
    const prettyEl = document.getElementById('response-pretty');
    const rawEl = document.getElementById('response-raw');
    prettyEl.innerHTML = this.prettyPrintJson(response.body);
    rawEl.textContent = response.body;

    // Preview
    const previewEl = document.getElementById('response-preview');
    try {
      previewEl.srcdoc = response.body;
    } catch {}

    // Headers
    const headersTable = document.getElementById('response-headers-table');
    headersTable.innerHTML = '';
    Object.entries(response.headers || {}).forEach(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'resp-header-row';
      row.innerHTML = `
        <span class="resp-header-key">${this.escapeHtml(key)}</span>
        <span class="resp-header-value">${this.escapeHtml(value)}</span>
      `;
      headersTable.appendChild(row);
    });
  },

  renderResponseError(error) {
    const placeholder = document.getElementById('response-placeholder');
    const content = document.getElementById('response-content');
    const errorEl = document.getElementById('response-error');

    placeholder.style.display = 'none';
    content.style.display = 'none';
    errorEl.style.display = 'flex';

    document.getElementById('error-title').textContent = 'Could not send request';
    const msg = error.message || String(error);
    let helpText = msg;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      helpText = msg + '\n\nThis might be due to CORS restrictions, network issues, or an invalid URL. ' +
        'If testing a local API, ensure it has CORS headers enabled.';
    }
    document.getElementById('error-message').textContent = helpText;
  },

  resetResponse() {
    document.getElementById('response-placeholder').style.display = 'flex';
    document.getElementById('response-content').style.display = 'none';
    document.getElementById('response-error').style.display = 'none';
  },

  // ---- Environment Manager ----
  renderEnvManager() {
    const envs = Environments.getAll();
    const activeId = Environments.getActiveId();

    let bodyHtml = `
      <div class="env-manager">
        <div class="env-list-section">
          <div class="env-list-header">
            <span>Environments</span>
            <button class="btn btn-icon btn-ghost" id="modal-add-env" title="Add Environment">+</button>
          </div>
          <div id="modal-env-list">
    `;

    envs.forEach(env => {
      bodyHtml += `
        <div class="env-list-item${env.id === activeId ? ' active' : ''}" data-env-id="${env.id}">
          <span>${this.escapeHtml(env.name)}</span>
          <button class="env-delete" data-env-id="${env.id}" title="Delete">&times;</button>
        </div>
      `;
    });

    if (envs.length === 0) {
      bodyHtml += '<p style="font-size:12px;color:var(--text-muted);padding:8px">No environments</p>';
    }

    bodyHtml += `
          </div>
        </div>
        <div class="env-detail-section" id="modal-env-detail">
          <div class="env-detail-placeholder"><p>Select an environment to edit</p></div>
        </div>
      </div>
    `;

    this.showModal('Manage Environments', bodyHtml, [
      { label: 'Close', primary: true }
    ]);

    // Make modal larger
    document.getElementById('modal').classList.add('modal-lg');

    // Wire up events
    document.getElementById('modal-add-env').onclick = () => {
      Environments.create('New Environment');
      this.renderEnvManager();
    };

    document.querySelectorAll('#modal-env-list .env-list-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.classList.contains('env-delete')) {
          Environments.delete(e.target.dataset.envId);
          this.renderEnvManager();
          App.refreshEnvSelector();
          return;
        }
        this._renderEnvDetail(item.dataset.envId);
        // Highlight
        document.querySelectorAll('#modal-env-list .env-list-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      };
    });
  },

  _renderEnvDetail(envId) {
    const env = Environments.get(envId);
    if (!env) return;

    const detail = document.getElementById('modal-env-detail');
    detail.innerHTML = `
      <input type="text" class="env-name-input" id="env-name-input" value="${this.escapeHtml(env.name)}">
      <div class="kv-editor" id="env-vars-editor"></div>
    `;

    // Name change
    document.getElementById('env-name-input').oninput = (e) => {
      Environments.update(envId, { name: e.target.value });
      const listItem = document.querySelector(`#modal-env-list .env-list-item[data-env-id="${envId}"] span`);
      if (listItem) listItem.textContent = e.target.value;
      App.refreshEnvSelector();
    };

    // Variables editor (Key + Value only, no description column)
    const vars = env.variables && env.variables.length > 0
      ? env.variables
      : [{ key: '', value: '', enabled: true }];

    this._renderEnvVarsEditor('env-vars-editor', vars, (updated) => {
      Environments.update(envId, { variables: updated });
    });
  },

  // Env-specific KV editor: Key + Value only (no description)
  _renderEnvVarsEditor(containerId, items, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'kv-header';
    header.innerHTML = `<span class="kv-check-head"></span><span>Variable</span><span>Value</span><span class="kv-delete-head"></span>`;
    container.appendChild(header);

    if (!items || items.length === 0) items = [{ key: '', value: '', enabled: true }];

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'kv-row';

      const check = document.createElement('input');
      check.type = 'checkbox'; check.className = 'kv-check';
      check.checked = item.enabled !== false;
      check.onchange = () => { items[idx].enabled = check.checked; onChange(items); };

      const keyInput = document.createElement('input');
      keyInput.type = 'text'; keyInput.className = 'kv-key';
      keyInput.placeholder = 'VARIABLE_NAME'; keyInput.value = item.key || '';
      keyInput.oninput = () => { items[idx].key = keyInput.value; onChange(items); maybeAddRow(); };

      const valInput = document.createElement('input');
      valInput.type = 'text'; valInput.className = 'kv-value';
      valInput.placeholder = 'value'; valInput.value = item.value || '';
      valInput.oninput = () => { items[idx].value = valInput.value; onChange(items); maybeAddRow(); };

      const del = document.createElement('button');
      del.className = 'kv-delete'; del.innerHTML = '&times;';
      del.onclick = () => { if (items.length > 1) { items.splice(idx, 1); onChange(items); this._renderEnvVarsEditor(containerId, items, onChange); } };

      row.append(check, keyInput, valInput, del);
      container.appendChild(row);
    });

    const maybeAddRow = () => {
      const last = items[items.length - 1];
      if (last && (last.key || last.value)) {
        items.push({ key: '', value: '', enabled: true });
        this._renderEnvVarsEditor(containerId, items, onChange);
      }
    };
  },

  // ---- Render Env Selector ----
  renderEnvSelector() {
    const select = document.getElementById('env-select');
    const activeId = Environments.getActiveId();
    const envs = Environments.getAll();

    select.innerHTML = '<option value="">No Environment</option>';
    envs.forEach(env => {
      const opt = document.createElement('option');
      opt.value = env.id;
      opt.textContent = env.name;
      if (env.id === activeId) opt.selected = true;
      select.appendChild(opt);
    });
  },

  // ---- Save Request Modal ----
  renderSaveModal(currentRequest, callback) {
    const collections = Collections.getAll();

    let colOptions = '<option value="">-- Select Collection --</option>';
    collections.forEach(col => {
      colOptions += `<option value="${col.id}">${this.escapeHtml(col.name)}</option>`;
    });

    const bodyHtml = `
      <div class="form-group">
        <label>Request Name</label>
        <input type="text" id="save-req-name" value="${this.escapeHtml(currentRequest.name || currentRequest.url || 'Untitled')}" style="width:100%">
      </div>
      <div class="form-group">
        <label>Save to Collection</label>
        <select id="save-collection-select" style="width:100%">${colOptions}</select>
      </div>
      <div class="form-group" id="save-folder-group" style="display:none">
        <label>Folder (optional)</label>
        <select id="save-folder-select" style="width:100%"><option value="">Root</option></select>
      </div>
      <div style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="save-create-collection">+ Create New Collection</button>
      </div>
    `;

    this.showModal('Save Request', bodyHtml, [
      { label: 'Cancel' },
      { label: 'Save', primary: true, close: false, onClick: () => {
        const name = document.getElementById('save-req-name').value || 'Untitled';
        const colId = document.getElementById('save-collection-select').value;
        const folderId = document.getElementById('save-folder-select')?.value || null;

        if (!colId) {
          UI.toast('Please select a collection', 'error');
          return;
        }

        callback(name, colId, folderId);
        this.closeModal();
      }}
    ]);

    // Collection change -> load folders
    document.getElementById('save-collection-select').onchange = (e) => {
      const colId = e.target.value;
      const folderGroup = document.getElementById('save-folder-group');
      const folderSelect = document.getElementById('save-folder-select');

      if (!colId) {
        folderGroup.style.display = 'none';
        return;
      }

      const col = Collections.get(colId);
      const folders = (col.items || []).filter(i => i.type === 'folder');

      if (folders.length > 0) {
        folderSelect.innerHTML = '<option value="">Root</option>';
        folders.forEach(f => {
          folderSelect.innerHTML += `<option value="${f.id}">${this.escapeHtml(f.name)}</option>`;
        });
        folderGroup.style.display = 'block';
      } else {
        folderGroup.style.display = 'none';
      }
    };

    // Create new collection
    document.getElementById('save-create-collection').onclick = async () => {
      const name = await this.prompt('New Collection', 'Collection Name', 'My Collection');
      if (name) {
        const col = Collections.create(name);
        // Refresh the select
        const select = document.getElementById('save-collection-select');
        const opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.name;
        opt.selected = true;
        select.appendChild(opt);
        select.dispatchEvent(new Event('change'));
        App.refreshSidebar();
      }
    };

    // Pre-select collection if we have context
    if (currentRequest.collectionId) {
      const select = document.getElementById('save-collection-select');
      select.value = currentRequest.collectionId;
      select.dispatchEvent(new Event('change'));
    }
  },

  // ---- Resize Handlers ----
  initResizers() {
    // Sidebar resizer
    this._initResize('sidebar-resize', 'x', (delta) => {
      const sidebar = document.getElementById('sidebar');
      const width = sidebar.offsetWidth + delta;
      if (width >= 200 && width <= 500) {
        sidebar.style.width = width + 'px';
      }
    });

    // Response resizer
    this._initResize('response-resize', 'y', (delta) => {
      const reqSection = document.querySelector('.request-section');
      const respSection = document.getElementById('response-section');
      const parentHeight = reqSection.parentElement.offsetHeight;
      const tabBarHeight = document.getElementById('tab-bar').offsetHeight;
      const available = parentHeight - tabBarHeight - 3; // 3 for resizer

      const reqH = reqSection.offsetHeight + delta;
      const respH = available - reqH;

      if (reqH >= 150 && respH >= 100) {
        reqSection.style.flex = 'none';
        reqSection.style.height = reqH + 'px';
        respSection.style.flex = '1';
      }
    });
  },

  _initResize(handleId, axis, onResize) {
    const handle = document.getElementById(handleId);
    if (!handle) return;

    let startPos = 0;
    let isResizing = false;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startPos = axis === 'x' ? e.clientX : e.clientY;
      handle.classList.add('active');
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (e) => {
        if (!isResizing) return;
        const currentPos = axis === 'x' ? e.clientX : e.clientY;
        const delta = currentPos - startPos;
        startPos = currentPos;
        onResize(delta);
      };

      const onMouseUp = () => {
        isResizing = false;
        handle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
};
