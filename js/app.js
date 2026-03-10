// ===== App - Main Orchestrator =====

const App = {
  tabs: [],
  activeTabId: null,
  abortController: null,
  _saveCollectionId: null,
  _saveFolderId: null,
  _initialized: false,

  init() {
    // Initialize auth first - app launches after login
    Auth.init((user) => this.onAuthStateChanged(user));

    // Login button
    document.getElementById('btn-google-login').onclick = () => Auth.signInWithGoogle();
  },

  onAuthStateChanged(user) {
    const loginScreen = document.getElementById('login-screen');
    const projectScreen = document.getElementById('project-screen');
    const appEl = document.getElementById('app');

    if (user) {
      // User is signed in — go to project selection
      loginScreen.style.display = 'none';
      appEl.style.display = 'none';

      // Update project screen user info
      document.getElementById('project-user-email').textContent = user.email;

      // Bind project screen buttons
      document.getElementById('btn-project-logout').onclick = () => Auth.signOut();
      document.getElementById('btn-create-project').onclick = () => this.createProject();

      // Always show project selection screen
      this.showProjectScreen();
    } else {
      // User is signed out - show login
      loginScreen.style.display = 'flex';
      projectScreen.style.display = 'none';
      appEl.style.display = 'none';
      Sync.stopSync();
      this._initialized = false;
      Projects.currentProject = null;
    }
  },

  async showProjectScreen() {
    const loginScreen = document.getElementById('login-screen');
    const projectScreen = document.getElementById('project-screen');
    const appEl = document.getElementById('app');

    loginScreen.style.display = 'none';
    projectScreen.style.display = 'flex';
    appEl.style.display = 'none';

    Sync.stopSync();

    // Load user's projects
    const listEl = document.getElementById('project-list');
    listEl.innerHTML = '<div class="project-loading">Loading projects...</div>';

    const projects = await Projects.getUserProjects();

    if (projects.length === 0) {
      listEl.innerHTML = `
        <div class="project-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" opacity="0.5">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <p>No projects yet</p>
          <p class="muted-text">Create a new project to get started, or ask a team member to invite you.</p>
        </div>`;
    } else {
      listEl.innerHTML = projects.map(p => {
        const memberCount = p.members ? p.members.length : 1;
        const isOwner = p.ownerEmail === (Auth.getUserEmail() || '').toLowerCase();
        return `
          <div class="project-item" data-id="${p.id}">
            <div class="project-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </div>
            <div class="project-item-info">
              <div class="project-item-name">${this._escHtml(p.name)}</div>
              <div class="project-item-meta">${memberCount} member${memberCount !== 1 ? 's' : ''}${isOwner ? ' · Owner' : ''}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" class="project-item-arrow">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>`;
      }).join('');

      // Bind click events
      listEl.querySelectorAll('.project-item').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.id;
          const project = projects.find(p => p.id === id);
          if (project) this.enterProject(project);
        };
      });
    }
  },

  async createProject() {
    const name = await UI.prompt('Create Project', 'Project Name', 'My API Project');
    if (!name) return;

    const project = await Projects.create(name);
    if (project) {
      UI.toast('Project created!', 'success');
      this.enterProject(project);
    } else {
      UI.toast('Failed to create project', 'error');
    }
  },

  enterProject(project) {
    Projects.setCurrentProject(project);

    const loginScreen = document.getElementById('login-screen');
    const projectScreen = document.getElementById('project-screen');
    const appEl = document.getElementById('app');

    loginScreen.style.display = 'none';
    projectScreen.style.display = 'none';
    appEl.style.display = 'flex';

    // Update project name badge in top bar
    const badge = document.getElementById('project-name-badge');
    if (badge) badge.textContent = project.name;

    // Update user profile
    const user = Auth.getUser();
    if (user) {
      document.getElementById('user-avatar').src = user.photoURL || '';
      document.getElementById('user-name').textContent = user.displayName || user.email;
    }

    if (!this._initialized) {
      this._initApp();
    } else {
      // Refresh data for new project
      Storage.clearProjectData();
    }

    // Start sync scoped to this project
    Sync.startSync();
  },

  _initApp() {
    this._initialized = true;
    this.loadTabs();
    this.bindEvents();
    this.refreshSidebar();
    this.refreshEnvSelector();
    UI.initResizers();

    // Restore CORS proxy toggle state
    const proxyToggle = document.getElementById('cors-proxy-toggle');
    proxyToggle.checked = !!Storage.getSetting('corsProxy');

    // Open a default tab if none exist
    if (this.tabs.length === 0) {
      this.newTab();
    }

    this.renderCurrentTab();
  },

  // ---- Tab Management ----
  createDefaultRequest() {
    return {
      method: 'GET',
      url: '',
      params: [{ key: '', value: '', description: '', enabled: true }],
      headers: [{ key: '', value: '', description: '', enabled: true }],
      body: { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] },
      auth: { type: 'none', bearer: { token: '' }, basic: { username: '', password: '' }, apikey: { key: '', value: '', addTo: 'header' } },
      scripts: { pre: '', test: '' }
    };
  },

  // Ensure a request object has all required sub-objects
  _ensureRequestDefaults(req) {
    if (!req) return this.createDefaultRequest();
    if (!req.body) req.body = { mode: 'none', raw: '', rawType: 'json', formData: [], urlencoded: [] };
    if (!req.body.rawType) req.body.rawType = 'json';
    if (!req.body.formData) req.body.formData = [];
    if (!req.body.urlencoded) req.body.urlencoded = [];
    if (!req.auth) req.auth = { type: 'none', bearer: { token: '' }, basic: { username: '', password: '' }, apikey: { key: '', value: '', addTo: 'header' } };
    if (!req.auth.bearer) req.auth.bearer = { token: '' };
    if (!req.auth.basic) req.auth.basic = { username: '', password: '' };
    if (!req.auth.apikey) req.auth.apikey = { key: '', value: '', addTo: 'header' };
    if (!req.params) req.params = [{ key: '', value: '', description: '', enabled: true }];
    if (!req.headers) req.headers = [{ key: '', value: '', description: '', enabled: true }];
    if (!req.scripts) req.scripts = { pre: '', test: '' };
    return req;
  },

  newTab() {
    const tab = {
      id: Storage.uuid(),
      name: 'Untitled',
      requestId: null,
      request: this.createDefaultRequest(),
      response: null,
      isDirty: false
    };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.saveTabs();
    this.renderTabs();
    this.renderCurrentTab();
    return tab;
  },

  openRequest(requestId) {
    // Check if already open in a tab
    const existing = this.tabs.find(t => t.requestId === requestId);
    if (existing) {
      this.switchTab(existing.id);
      return;
    }

    const req = Collections.getRequest(requestId);
    if (!req) return;

    const cloned = JSON.parse(JSON.stringify(req));
    this._ensureRequestDefaults(cloned);

    const tab = {
      id: Storage.uuid(),
      name: req.name || 'Untitled',
      requestId: req.id,
      request: cloned,
      response: null,
      isDirty: false
    };
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.saveTabs();
    this.renderTabs();
    this.renderCurrentTab();
  },

  openFromHistory(entry) {
    const tab = this.newTab();
    tab.request = this._ensureRequestDefaults(JSON.parse(JSON.stringify(entry.request)));
    tab.name = entry.request.url || 'Untitled';
    tab.isDirty = true;
    // Also show the response
    tab.response = entry.response;
    this.saveTabs();
    this.renderTabs();
    this.renderCurrentTab();
  },

  switchTab(tabId) {
    if (this.activeTabId === tabId) return;
    // Save current tab state first
    this.saveCurrentTabState();
    this.activeTabId = tabId;
    this.saveTabs();
    this.renderTabs();
    this.renderCurrentTab();
  },

  closeTab(tabId) {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    this.tabs.splice(idx, 1);

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        this.activeTabId = this.tabs[Math.min(idx, this.tabs.length - 1)].id;
      } else {
        this.activeTabId = null;
      }
    }

    this.saveTabs();
    this.renderTabs();

    if (this.tabs.length === 0) {
      this.newTab();
    } else {
      this.renderCurrentTab();
    }
  },

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  },

  saveTabs() {
    // Save minimal tab state (not full response bodies)
    const toSave = this.tabs.map(t => ({
      id: t.id,
      name: t.name,
      requestId: t.requestId,
      request: t.request,
      isDirty: t.isDirty
      // Don't persist response data
    }));
    Storage.setSetting('tabs', toSave);
    Storage.setSetting('activeTab', this.activeTabId);
  },

  loadTabs() {
    this.tabs = Storage.getSetting('tabs') || [];
    this.activeTabId = Storage.getSetting('activeTab') || null;

    // Ensure each tab has proper defaults
    this.tabs.forEach(tab => {
      tab.request = this._ensureRequestDefaults(tab.request);
    });
  },

  // ---- Save current form state into the active tab ----
  saveCurrentTabState() {
    const tab = this.getActiveTab();
    if (!tab) return;

    this._ensureRequestDefaults(tab.request);

    tab.request.method = document.getElementById('method-select').value;
    tab.request.url = document.getElementById('url-input').value;

    // Body raw
    tab.request.body.raw = document.getElementById('body-raw-editor').value;
    tab.request.body.rawType = document.getElementById('raw-type-select').value;

    // Body mode
    const bodyRadio = document.querySelector('input[name="body-type"]:checked');
    if (bodyRadio) tab.request.body.mode = bodyRadio.value;

    // Auth
    tab.request.auth.type = document.getElementById('auth-type-select').value;
    tab.request.auth.bearer.token = document.getElementById('auth-bearer-token').value;
    tab.request.auth.basic.username = document.getElementById('auth-basic-username').value;
    tab.request.auth.basic.password = document.getElementById('auth-basic-password').value;
    tab.request.auth.apikey.key = document.getElementById('auth-apikey-key').value;
    tab.request.auth.apikey.value = document.getElementById('auth-apikey-value').value;
    tab.request.auth.apikey.addTo = document.getElementById('auth-apikey-addto').value;

    // Scripts
    const preScript = document.getElementById('script-pre-editor');
    const testScript = document.getElementById('script-test-editor');
    if (preScript) tab.request.scripts.pre = preScript.value;
    if (testScript) tab.request.scripts.test = testScript.value;

    this.saveTabs();
  },

  // ---- Rendering ----
  renderTabs() {
    UI.renderTabs(this.tabs, this.activeTabId);
  },

  renderCurrentTab() {
    const tab = this.getActiveTab();
    if (!tab) return;

    const req = tab.request;

    // URL bar
    const methodSelect = document.getElementById('method-select');
    methodSelect.value = req.method || 'GET';
    this.updateMethodColor();

    document.getElementById('url-input').value = req.url || '';
    this.updateUrlHighlight();

    // Params
    const params = req.params && req.params.length > 0
      ? req.params : [{ key: '', value: '', description: '', enabled: true }];
    UI.renderKVEditor('params-editor', params, (updated) => {
      tab.request.params = updated;
      tab.isDirty = true;
      this.updateParamsBadge();
      this.renderTabs();
      this.autoSaveToCollection();
    });
    this.updateParamsBadge();

    // Headers
    const headers = req.headers && req.headers.length > 0
      ? req.headers : [{ key: '', value: '', description: '', enabled: true }];
    UI.renderKVEditor('headers-editor', headers, (updated) => {
      tab.request.headers = updated;
      tab.isDirty = true;
      this.updateHeadersBadge();
      this.renderTabs();
      this.autoSaveToCollection();
    });
    this.updateHeadersBadge();

    // Body
    const bodyMode = req.body ? req.body.mode : 'none';
    document.querySelectorAll('input[name="body-type"]').forEach(r => {
      r.checked = r.value === bodyMode;
    });
    this.showBodyPanel(bodyMode);
    document.getElementById('body-raw-editor').value = req.body ? req.body.raw || '' : '';
    document.getElementById('raw-type-select').value = req.body ? req.body.rawType || 'json' : 'json';

    // Form data editor
    const formData = (req.body && req.body.formData && req.body.formData.length > 0)
      ? req.body.formData : [{ key: '', value: '', description: '', enabled: true }];
    UI.renderKVEditor('form-data-editor', formData, (updated) => {
      tab.request.body.formData = updated;
      tab.isDirty = true;
      this.renderTabs();
      this.autoSaveToCollection();
    });

    // URL encoded editor
    const urlencoded = (req.body && req.body.urlencoded && req.body.urlencoded.length > 0)
      ? req.body.urlencoded : [{ key: '', value: '', description: '', enabled: true }];
    UI.renderKVEditor('urlencoded-editor', urlencoded, (updated) => {
      tab.request.body.urlencoded = updated;
      tab.isDirty = true;
      this.renderTabs();
      this.autoSaveToCollection();
    });

    // Auth
    document.getElementById('auth-type-select').value = req.auth ? req.auth.type : 'none';
    this.showAuthPanel(req.auth ? req.auth.type : 'none');
    if (req.auth) {
      document.getElementById('auth-bearer-token').value = req.auth.bearer ? req.auth.bearer.token || '' : '';
      document.getElementById('auth-basic-username').value = req.auth.basic ? req.auth.basic.username || '' : '';
      document.getElementById('auth-basic-password').value = req.auth.basic ? req.auth.basic.password || '' : '';
      document.getElementById('auth-apikey-key').value = req.auth.apikey ? req.auth.apikey.key || '' : '';
      document.getElementById('auth-apikey-value').value = req.auth.apikey ? req.auth.apikey.value || '' : '';
      document.getElementById('auth-apikey-addto').value = req.auth.apikey ? req.auth.apikey.addTo || 'header' : 'header';
    }

    // Scripts
    const preEditor = document.getElementById('script-pre-editor');
    const testEditor = document.getElementById('script-test-editor');
    if (preEditor) preEditor.value = (req.scripts && req.scripts.pre) || '';
    if (testEditor) testEditor.value = (req.scripts && req.scripts.test) || '';

    // Response
    if (tab.response) {
      UI.renderResponse(tab.response);
    } else {
      UI.resetResponse();
    }
  },

  updateMethodColor() {
    const select = document.getElementById('method-select');
    select.className = `method-select method-${select.value}`;
  },

  updateParamsBadge() {
    const tab = this.getActiveTab();
    const count = tab ? (tab.request.params || []).filter(p => p.enabled && p.key).length : 0;
    const badge = document.getElementById('params-count');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  },

  updateHeadersBadge() {
    const tab = this.getActiveTab();
    const count = tab ? (tab.request.headers || []).filter(h => h.enabled && h.key).length : 0;
    const badge = document.getElementById('headers-count');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  },

  showBodyPanel(mode) {
    document.getElementById('body-none').classList.toggle('active', mode === 'none');
    document.getElementById('body-raw').classList.toggle('active', mode === 'raw');
    document.getElementById('body-form-data').classList.toggle('active', mode === 'form-data');
    document.getElementById('body-urlencoded').classList.toggle('active', mode === 'x-www-form-urlencoded');
    document.getElementById('raw-type-select').style.display = mode === 'raw' ? '' : 'none';
  },

  showAuthPanel(type) {
    document.getElementById('auth-none').classList.toggle('active', type === 'none');
    document.getElementById('auth-bearer').classList.toggle('active', type === 'bearer');
    document.getElementById('auth-basic').classList.toggle('active', type === 'basic');
    document.getElementById('auth-apikey').classList.toggle('active', type === 'apikey');
  },

  // ---- Variable Highlighting ----
  updateUrlHighlight() {
    const input = document.getElementById('url-input');
    const highlight = document.getElementById('url-highlight');
    if (!input || !highlight) return;

    const text = input.value;
    // Escape HTML then wrap {{vars}} in highlight spans
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const highlighted = escaped.replace(
      /(\{\{[^}]*\}\})/g,
      '<span class="var-highlight">$1</span>'
    );
    highlight.innerHTML = highlighted;
    highlight.scrollLeft = input.scrollLeft;
  },

  // ---- Scripting Engine ----
  _createScriptContext(req, response) {
    const results = [];
    const envVars = {};

    // Load current environment variables
    const activeEnv = Environments.getActive();
    if (activeEnv && activeEnv.variables) {
      activeEnv.variables.forEach(v => {
        if (v.key) envVars[v.key] = v.value || '';
      });
    }

    const pm = {
      environment: {
        get(key) { return envVars[key] || ''; },
        set(key, value) {
          envVars[key] = value;
          // Persist to active environment
          if (activeEnv) {
            const existing = activeEnv.variables.find(v => v.key === key);
            if (existing) {
              existing.value = String(value);
            } else {
              activeEnv.variables.push({ key, value: String(value), enabled: true });
            }
            Environments.update(activeEnv.id, { variables: activeEnv.variables });
          }
        }
      },
      request: {
        url: req.url || '',
        method: req.method || 'GET',
        headers: {},
        body: req.body ? req.body.raw || '' : ''
      },
      response: response ? {
        status: response.status,
        statusText: response.statusText,
        body: response.body || '',
        headers: response.headers || {},
        time: response.time || 0,
        json() {
          try { return JSON.parse(response.body); } catch { return null; }
        }
      } : null,
      test(name, fn) {
        try {
          const result = fn();
          results.push({ name, pass: result !== false, error: null });
        } catch (err) {
          results.push({ name, pass: false, error: err.message });
        }
      },
      expect(value) {
        return {
          to: {
            equal(expected) { if (value !== expected) throw new Error(`Expected ${expected} but got ${value}`); },
            be: {
              above(n) { if (!(value > n)) throw new Error(`Expected ${value} to be above ${n}`); },
              below(n) { if (!(value < n)) throw new Error(`Expected ${value} to be below ${n}`); },
              true: (() => { if (value !== true) throw new Error(`Expected true but got ${value}`); })(),
            },
            include(str) { if (!String(value).includes(str)) throw new Error(`Expected "${value}" to include "${str}"`); },
            have: {
              property(prop) { if (!(prop in value)) throw new Error(`Missing property "${prop}"`); }
            }
          }
        };
      }
    };

    // Set request headers from the request object
    if (req.headers) {
      req.headers.forEach(h => {
        if (h.enabled && h.key) pm.request.headers[h.key] = h.value || '';
      });
    }

    return { pm, results };
  },

  async runScript(script, req, response) {
    if (!script || !script.trim()) return [];
    const { pm, results } = this._createScriptContext(req, response);
    try {
      const fn = new Function('pm', 'console', script);
      fn(pm, console);
    } catch (err) {
      results.push({ name: 'Script Error', pass: false, error: err.message });
    }
    return results;
  },

  renderTestResults(results) {
    if (!results || results.length === 0) return;
    // Show test results in response section
    const container = document.getElementById('response-test-results');
    if (!container) return;
    container.innerHTML = results.map(r => `
      <div class="test-result ${r.pass ? 'pass' : 'fail'}">
        <span class="test-result-icon">${r.pass ? 'PASS' : 'FAIL'}</span>
        <span class="test-result-name">${UI.escapeHtml(r.name)}</span>
        ${r.error ? `<span class="test-result-error">${UI.escapeHtml(r.error)}</span>` : ''}
      </div>
    `).join('');
    container.style.display = '';
  },

  // ---- Auto-save to collection (debounced) ----
  _autoSaveTimer: null,
  autoSaveToCollection() {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      const tab = this.getActiveTab();
      if (!tab || !tab.requestId) return;

      try {
        this.saveCurrentTabState();
      } catch (e) { return; }

      const existing = Collections.getRequest(tab.requestId);
      if (!existing) return;

      const updated = JSON.parse(JSON.stringify(tab.request));
      updated.id = existing.id;
      updated.collectionId = existing.collectionId;
      updated.name = tab.name;
      updated.createdAt = existing.createdAt;
      Collections.updateRequest(updated);
      tab.isDirty = false;
      this.renderTabs();
    }, 1500); // Save 1.5s after last change
  },

  // ---- Send Request ----
  async sendRequest() {
    const tab = this.getActiveTab();
    if (!tab) return;

    try {
      this.saveCurrentTabState();
    } catch (e) {
      console.error('saveCurrentTabState error:', e);
    }
    const req = tab.request;

    if (!req.url) {
      UI.toast('Please enter a URL', 'error');
      return;
    }

    // Show loading
    const sendBtn = document.getElementById('btn-send');
    sendBtn.querySelector('.send-text').style.display = 'none';
    sendBtn.querySelector('.send-loading').style.display = '';
    sendBtn.classList.add('sending');

    try {
      // Run pre-request script
      if (req.scripts && req.scripts.pre) {
        const preResults = await this.runScript(req.scripts.pre, req, null);
        if (preResults.some(r => !r.pass)) {
          UI.toast('Pre-request script failed', 'error');
        }
      }

      this.abortController = new AbortController();
      const response = await RequestEngine.send(req, this.abortController.signal);

      tab.response = response;
      UI.renderResponse(response);

      // Run test script
      if (req.scripts && req.scripts.test) {
        const testResults = await this.runScript(req.scripts.test, req, response);
        this.renderTestResults(testResults);
      }

      // Add to history
      History.add(req, response);
      this.refreshSidebar();

      UI.toast(`${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');
    } catch (error) {
      if (error.name === 'AbortError') {
        UI.toast('Request cancelled', 'info');
        return;
      }
      tab.response = null;
      UI.renderResponseError(error);
      UI.toast('Request failed: ' + error.message, 'error');
    } finally {
      sendBtn.querySelector('.send-text').style.display = '';
      sendBtn.querySelector('.send-loading').style.display = 'none';
      sendBtn.classList.remove('sending');
      this.abortController = null;
    }
  },

  // ---- Save Request ----
  saveRequest() {
    const tab = this.getActiveTab();
    if (!tab) return;

    this.saveCurrentTabState();

    // If already saved to a collection, just update
    if (tab.requestId) {
      const existing = Collections.getRequest(tab.requestId);
      if (existing) {
        const updated = JSON.parse(JSON.stringify(tab.request));
        updated.id = existing.id;
        updated.collectionId = existing.collectionId;
        updated.name = tab.name;
        updated.createdAt = existing.createdAt;
        Collections.updateRequest(updated);
        tab.isDirty = false;
        this.saveTabs();
        this.renderTabs();
        this.refreshSidebar();
        UI.toast('Request saved', 'success');
        return;
      }
    }

    // Show save modal
    UI.renderSaveModal(tab.request, (name, collectionId, folderId) => {
      const reqData = { ...tab.request, name };
      if (tab.requestId) reqData.id = tab.requestId;

      const saved = Collections.saveRequest(collectionId, folderId, reqData);
      tab.requestId = saved.id;
      tab.name = name;
      tab.request.collectionId = collectionId;
      tab.isDirty = false;
      this.saveTabs();
      this.renderTabs();
      this.refreshSidebar();
      UI.toast('Request saved to collection', 'success');
    });
  },

  setActiveCollectionForSave(colId, folderId) {
    this._saveCollectionId = colId;
    this._saveFolderId = folderId;
  },

  // ---- Sidebar ----
  refreshSidebar() {
    const activePanel = document.querySelector('.sidebar-tab.active');
    const tab = activePanel ? activePanel.dataset.tab : 'collections';

    if (tab === 'collections') {
      UI.renderCollections(Collections.getAll());
    } else {
      UI.renderHistory(History.getAll());
    }
  },

  refreshEnvSelector() {
    UI.renderEnvSelector();
  },

  // ---- Team Management ----
  async showTeamManager() {
    const project = Projects.currentProject;
    if (!project) return;

    // Refresh project data
    const freshProject = await Projects.getProject(project.id);
    if (freshProject) Projects.currentProject = freshProject;

    const p = Projects.currentProject;
    const isAdmin = Projects.isAdmin();
    const isOwner = Projects.isOwner();

    let membersHtml = p.members.map(m => {
      const email = typeof m === 'string' ? m : m.email;
      const name = typeof m === 'string' ? m : (m.name || m.email);
      const role = typeof m === 'string' ? 'member' : (m.role || 'member');
      const isCurrentUser = email === Auth.getUserEmail();
      const isMemberOwner = role === 'owner';

      return `
        <div class="team-member-row">
          <div class="team-member-info">
            <div class="team-member-name">${this._escHtml(name)}</div>
            <div class="team-member-email">${this._escHtml(email)}</div>
          </div>
          <span class="team-member-role role-${role}">${role}</span>
          ${isAdmin && !isMemberOwner && !isCurrentUser ? `
            <button class="btn btn-sm btn-danger-text team-remove-btn" data-email="${this._escHtml(email)}" title="Remove member">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>`;
    }).join('');

    const body = `
      <div class="team-manager">
        <div class="team-project-info">
          <div class="form-group">
            <label>Project Name</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="text" id="team-project-name" value="${this._escHtml(p.name)}" ${isAdmin ? '' : 'disabled'} style="flex:1">
              ${isAdmin ? '<button class="btn btn-sm btn-primary" id="btn-rename-project">Rename</button>' : ''}
            </div>
          </div>
        </div>
        ${isAdmin ? `
        <div class="team-invite-section">
          <label class="form-group-label">Invite Member</label>
          <div class="team-invite-row">
            <input type="email" id="invite-email" placeholder="teammate@gmail.com" style="flex:1">
            <select id="invite-role" style="width:100px">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button class="btn btn-primary btn-sm" id="btn-invite-member">Invite</button>
          </div>
        </div>
        ` : ''}
        <div class="team-members-section">
          <label class="form-group-label">Team Members (${p.members.length})</label>
          <div class="team-members-list">${membersHtml}</div>
        </div>
        ${isOwner ? `
        <div class="team-danger-zone">
          <label class="form-group-label" style="color:var(--danger)">Danger Zone</label>
          <button class="btn btn-sm btn-danger-text" id="btn-delete-project">Delete Project</button>
        </div>
        ` : ''}
      </div>`;

    UI.showModal('Team Management', body, '');

    // Bind events
    if (isAdmin) {
      document.getElementById('btn-rename-project').onclick = async () => {
        const newName = document.getElementById('team-project-name').value.trim();
        if (!newName) return;
        const result = await Projects.renameProject(p.id, newName);
        if (result.success) {
          document.getElementById('project-name-badge').textContent = newName;
          UI.toast('Project renamed', 'success');
        } else {
          UI.toast(result.error, 'error');
        }
      };

      document.getElementById('btn-invite-member').onclick = async () => {
        const email = document.getElementById('invite-email').value.trim().toLowerCase();
        const role = document.getElementById('invite-role').value;
        if (!email) { UI.toast('Enter an email address', 'error'); return; }
        if (!email.includes('@')) { UI.toast('Invalid email address', 'error'); return; }

        const result = await Projects.inviteMember(p.id, email, role);
        if (result.success) {
          UI.toast(`${email} invited!`, 'success');
          UI.closeModal();
          this.showTeamManager(); // Refresh
        } else {
          UI.toast(result.error, 'error');
        }
      };

      // Handle Enter key in email input
      document.getElementById('invite-email').onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('btn-invite-member').click();
        }
      };
    }

    // Remove member buttons
    document.querySelectorAll('.team-remove-btn').forEach(btn => {
      btn.onclick = async () => {
        const email = btn.dataset.email;
        const confirmed = await UI.confirm('Remove Member', `Remove ${email} from this project?`);
        if (!confirmed) return;
        const result = await Projects.removeMember(p.id, email);
        if (result.success) {
          UI.toast(`${email} removed`, 'info');
          UI.closeModal();
          this.showTeamManager();
        } else {
          UI.toast(result.error, 'error');
        }
      };
    });

    // Delete project
    if (isOwner) {
      document.getElementById('btn-delete-project').onclick = async () => {
        const confirmed = await UI.confirm('Delete Project', 'This will permanently delete this project and ALL its data. This cannot be undone. Are you sure?');
        if (!confirmed) return;
        const result = await Projects.deleteProject(p.id);
        if (result.success) {
          Storage.setSetting('currentProjectId', null);
          UI.closeModal();
          UI.toast('Project deleted', 'info');
          this.showProjectScreen();
        } else {
          UI.toast(result.error, 'error');
        }
      };
    }
  },

  // ---- Collection Actions ----
  async addFolder(collectionId) {
    const name = await UI.prompt('New Folder', 'Folder Name', 'New Folder');
    if (name) {
      Collections.addFolder(collectionId, name);
      this.refreshSidebar();
    }
  },

  async renameCollection(collectionId) {
    const col = Collections.get(collectionId);
    if (!col) return;
    const name = await UI.prompt('Rename Collection', 'Collection Name', col.name);
    if (name) {
      Collections.update(collectionId, { name });
      this.refreshSidebar();
    }
  },

  async renameFolder(collectionId, folderId) {
    const col = Collections.get(collectionId);
    if (!col) return;
    const folder = col.items.find(i => i.id === folderId);
    if (!folder) return;
    const name = await UI.prompt('Rename Folder', 'Folder Name', folder.name);
    if (name) {
      folder.name = name;
      Collections.update(collectionId, { items: col.items });
      this.refreshSidebar();
    }
  },

  async renameRequest(collectionId, requestId) {
    const req = Collections.getRequest(requestId);
    if (!req) return;
    const name = await UI.prompt('Rename Request', 'Request Name', req.name);
    if (name) {
      Collections.renameItem(collectionId, requestId, name);
      // Update tab name if open
      const tab = this.tabs.find(t => t.requestId === requestId);
      if (tab) {
        tab.name = name;
        this.renderTabs();
      }
      this.refreshSidebar();
    }
  },

  async deleteCollection(collectionId) {
    const confirmed = await UI.confirm('Delete Collection', 'This will delete the collection and all its requests. Are you sure?');
    if (confirmed) {
      Collections.delete(collectionId);
      this.refreshSidebar();
      UI.toast('Collection deleted', 'info');
    }
  },

  async deleteFolder(collectionId, folderId) {
    const confirmed = await UI.confirm('Delete Folder', 'This will delete the folder and all its requests. Are you sure?');
    if (confirmed) {
      Collections.deleteFolder(collectionId, folderId);
      this.refreshSidebar();
    }
  },

  async deleteRequest(collectionId, requestId) {
    Collections.deleteRequest(collectionId, requestId);
    // Close tab if open
    const tab = this.tabs.find(t => t.requestId === requestId);
    if (tab) this.closeTab(tab.id);
    this.refreshSidebar();
  },

  duplicateRequest(collectionId, requestId, folderId) {
    Collections.duplicateRequest(collectionId, requestId, folderId);
    this.refreshSidebar();
    UI.toast('Request duplicated', 'success');
  },

  exportCollection(collectionId) {
    const data = Collections.exportCollection(collectionId);
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.collection.name || 'collection'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Collection exported', 'success');
  },

  importCollection(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const col = Collections.importCollection(data);
        if (col) {
          // Push imported collection to cloud for team sync
          Sync.saveCollection(col);
          if (col.items) Sync._pushRequests(col.items);
          this.refreshSidebar();
          UI.toast(`Imported "${col.name}" — syncing to team`, 'success');
        } else {
          UI.toast('Invalid collection file format', 'error');
        }
      } catch (err) {
        UI.toast('Failed to parse JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  // HTML escape helper
  _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  // ---- Event Binding ----
  bindEvents() {
    // Logout
    document.getElementById('btn-logout').onclick = () => Auth.signOut();

    // New tab / request
    document.getElementById('btn-new-tab').onclick = () => this.newTab();

    // Import
    const importFile = document.getElementById('import-file');
    document.getElementById('btn-import').onclick = () => importFile.click();
    importFile.onchange = (e) => {
      if (e.target.files[0]) {
        this.importCollection(e.target.files[0]);
        e.target.value = '';
      }
    };

    // New collection
    document.getElementById('btn-new-collection').onclick = async () => {
      const name = await UI.prompt('New Collection', 'Collection Name', 'My Collection');
      if (name) {
        Collections.create(name);
        this.refreshSidebar();
        UI.toast('Collection created', 'success');
      }
    };

    // Clear history
    document.getElementById('btn-clear-history').onclick = async () => {
      const confirmed = await UI.confirm('Clear History', 'Remove all history entries?');
      if (confirmed) {
        History.clear();
        this.refreshSidebar();
        UI.toast('History cleared', 'info');
      }
    };

    // Send
    document.getElementById('btn-send').onclick = () => this.sendRequest();

    // Save
    document.getElementById('btn-save').onclick = () => this.saveRequest();

    // Team management
    document.getElementById('btn-team').onclick = () => this.showTeamManager();

    // Switch project
    document.getElementById('btn-switch-project').onclick = () => {
      Sync.stopSync();
      this.showProjectScreen();
    };

    // CORS proxy toggle
    document.getElementById('cors-proxy-toggle').onchange = (e) => {
      Storage.setSetting('corsProxy', e.target.checked);
      UI.toast(e.target.checked ? 'CORS Proxy enabled — make sure proxy.js is running' : 'CORS Proxy disabled', 'info');
    };

    // Copy response
    document.getElementById('btn-copy-response').onclick = () => {
      const tab = this.getActiveTab();
      if (tab && tab.response) {
        navigator.clipboard.writeText(tab.response.body).then(() => {
          UI.toast('Response copied to clipboard', 'success');
        });
      }
    };

    // Method select color
    document.getElementById('method-select').onchange = () => {
      this.updateMethodColor();
      const tab = this.getActiveTab();
      if (tab) {
        tab.request.method = document.getElementById('method-select').value;
        tab.isDirty = true;
        this.renderTabs();
        this.autoSaveToCollection();
      }
    };

    // URL input
    const urlInput = document.getElementById('url-input');
    urlInput.oninput = () => {
      const tab = this.getActiveTab();
      if (tab) {
        tab.request.url = urlInput.value;
        tab.isDirty = true;
        tab.name = tab.request.name || tab.request.url || 'Untitled';
        this.renderTabs();
        this.autoSaveToCollection();
      }
      this.updateUrlHighlight();
    };
    urlInput.onscroll = () => {
      document.getElementById('url-highlight').scrollLeft = urlInput.scrollLeft;
    };

    // Sidebar tabs
    document.querySelectorAll('.sidebar-tab').forEach(tabEl => {
      tabEl.onclick = () => {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${tabEl.dataset.tab}`).classList.add('active');
        this.refreshSidebar();
      };
    });

    // Request panel tabs
    document.querySelectorAll('#request-tabs .panel-tab').forEach(tabEl => {
      tabEl.onclick = () => {
        document.querySelectorAll('#request-tabs .panel-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        document.querySelectorAll('.request-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${tabEl.dataset.panel}`).classList.add('active');
      };
    });

    // Response panel tabs
    document.querySelectorAll('#response-tabs .panel-tab').forEach(tabEl => {
      tabEl.onclick = () => {
        document.querySelectorAll('#response-tabs .panel-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        document.querySelectorAll('.response-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${tabEl.dataset.panel}`).classList.add('active');
      };
    });

    // Response body view tabs (Pretty/Raw/Preview)
    document.querySelectorAll('.resp-body-tab').forEach(tabEl => {
      tabEl.onclick = () => {
        document.querySelectorAll('.resp-body-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
        const view = tabEl.dataset.view;
        document.getElementById('response-pretty').classList.toggle('active', view === 'pretty');
        document.getElementById('response-raw').classList.toggle('active', view === 'raw');
        document.getElementById('response-preview').classList.toggle('active', view === 'preview');
      };
    });

    // Body type radio buttons
    document.querySelectorAll('input[name="body-type"]').forEach(radio => {
      radio.onchange = () => {
        const tab = this.getActiveTab();
        if (tab) {
          tab.request.body.mode = radio.value;
          tab.isDirty = true;
          this.renderTabs();
        }
        this.showBodyPanel(radio.value);
      };
    });

    // Raw type select
    document.getElementById('raw-type-select').onchange = (e) => {
      const tab = this.getActiveTab();
      if (tab) {
        tab.request.body.rawType = e.target.value;
      }
    };

    // Body raw editor
    document.getElementById('body-raw-editor').oninput = () => {
      const tab = this.getActiveTab();
      if (tab) {
        tab.request.body.raw = document.getElementById('body-raw-editor').value;
        tab.isDirty = true;
        this.renderTabs();
        this.autoSaveToCollection();
      }
    };

    // Auth type
    document.getElementById('auth-type-select').onchange = (e) => {
      const tab = this.getActiveTab();
      if (tab) {
        tab.request.auth.type = e.target.value;
        tab.isDirty = true;
        this.renderTabs();
        this.autoSaveToCollection();
      }
      this.showAuthPanel(e.target.value);
    };

    // Auth field changes
    ['auth-bearer-token', 'auth-basic-username', 'auth-basic-password',
     'auth-apikey-key', 'auth-apikey-value', 'auth-apikey-addto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.oninput = el.onchange = () => {
          const tab = this.getActiveTab();
          if (tab) {
            tab.isDirty = true;
            this.saveCurrentTabState();
            this.autoSaveToCollection();
          }
        };
      }
    });

    // Environment selector
    document.getElementById('env-select').onchange = (e) => {
      Environments.setActive(e.target.value);
    };

    // Manage environments
    document.getElementById('btn-manage-env').onclick = () => {
      UI.renderEnvManager();
    };

    // Modal close
    document.getElementById('modal-close').onclick = () => UI.closeModal();
    document.getElementById('modal-overlay').onclick = (e) => {
      if (e.target === e.currentTarget) UI.closeModal();
    };

    // Close context menu on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        UI.hideContextMenu();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter -> Send
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.sendRequest();
      }
      // Ctrl+S -> Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveRequest();
      }
      // Ctrl+N -> New Tab
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.newTab();
      }
      // Ctrl+W -> Close Tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (this.activeTabId) this.closeTab(this.activeTabId);
      }
      // Escape -> Close modal/context menu
      if (e.key === 'Escape') {
        UI.closeModal();
        UI.hideContextMenu();
      }
    });

    // Tab support in body editor
    document.getElementById('body-raw-editor').addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
      }
    });
  }
};

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', () => App.init());
