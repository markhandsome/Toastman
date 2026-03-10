// ===== Firestore Sync Module =====
// Real-time sync of collections, requests, and environments scoped to the current project

const Sync = {
  _listeners: [],
  _ready: false,
  _initialLoadDone: false,

  _getProjectId() {
    return Projects.getCurrentProjectId();
  },

  // Start real-time listeners scoped to the current project
  startSync() {
    this.stopSync();

    const projectId = this._getProjectId();
    if (!projectId) {
      console.warn('No project selected, skipping sync');
      return;
    }

    this._ready = true;
    this._initialLoadDone = false;
    this._updateStatus('syncing');

    // Clear local data before loading project data
    Storage.clearProjectData();

    // Listen to collections for this project
    this._listeners.push(
      db.collection('collections').where('projectId', '==', projectId).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          data.id = change.doc.id;
          if (change.type === 'added' || change.type === 'modified') {
            Storage.set('collections', data.id, data);
          } else if (change.type === 'removed') {
            Storage.delete('collections', data.id);
          }
        });
        this._onDataChanged('collections');
      }, (err) => {
        console.error('Collections sync error:', err);
        this._updateStatus('error');
      })
    );

    // Listen to requests for this project
    this._listeners.push(
      db.collection('requests').where('projectId', '==', projectId).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          data.id = change.doc.id;
          if (change.type === 'added' || change.type === 'modified') {
            Storage.set('requests', data.id, data);
          } else if (change.type === 'removed') {
            Storage.delete('requests', data.id);
          }
        });
        this._onDataChanged('requests');
      }, (err) => {
        console.error('Requests sync error:', err);
      })
    );

    // Listen to environments for this project
    this._listeners.push(
      db.collection('environments').where('projectId', '==', projectId).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          data.id = change.doc.id;
          if (change.type === 'added' || change.type === 'modified') {
            Storage.set('environments', data.id, data);
          } else if (change.type === 'removed') {
            Storage.delete('environments', data.id);
          }
        });
        this._onDataChanged('environments');
      }, (err) => {
        console.error('Environments sync error:', err);
      })
    );
  },

  stopSync() {
    this._listeners.forEach(unsub => unsub());
    this._listeners = [];
    this._ready = false;
    this._initialLoadDone = false;
  },

  _onDataChanged(type) {
    if (!this._initialLoadDone) {
      this._initialLoadDone = true;
      this._updateStatus('synced');
    }
    // Refresh the UI
    if (typeof App !== 'undefined' && App._initialized) {
      App.refreshSidebar();
      if (type === 'environments') {
        App.refreshEnvSelector();
      }
    }
  },

  _updateStatus(state) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const label = el.querySelector('.sync-label');
    el.classList.remove('syncing', 'synced', 'error');
    el.classList.add(state);
    if (state === 'syncing') label.textContent = 'Syncing...';
    else if (state === 'synced') label.textContent = 'Synced';
    else if (state === 'error') label.textContent = 'Offline';
  },

  // ---- Push data to Firestore (all writes include projectId) ----

  async saveCollection(col) {
    if (!this._ready) return;
    const projectId = this._getProjectId();
    if (!projectId) return;
    try {
      const data = { ...col, projectId, updatedBy: Auth.getUserEmail(), updatedAt: Date.now() };
      await db.collection('collections').doc(col.id).set(data);
    } catch (err) {
      console.error('Error saving collection:', err);
    }
  },

  async deleteCollection(id) {
    if (!this._ready) return;
    try {
      await db.collection('collections').doc(id).delete();
    } catch (err) {
      console.error('Error deleting collection:', err);
    }
  },

  async saveRequest(req) {
    if (!this._ready) return;
    const projectId = this._getProjectId();
    if (!projectId) return;
    try {
      const data = { ...req, projectId, updatedBy: Auth.getUserEmail(), updatedAt: Date.now() };
      await db.collection('requests').doc(req.id).set(data);
    } catch (err) {
      console.error('Error saving request:', err);
    }
  },

  async deleteRequest(id) {
    if (!this._ready) return;
    try {
      await db.collection('requests').doc(id).delete();
    } catch (err) {
      console.error('Error deleting request:', err);
    }
  },

  async saveEnvironment(env) {
    if (!this._ready) return;
    const projectId = this._getProjectId();
    if (!projectId) return;
    try {
      const data = { ...env, projectId, updatedBy: Auth.getUserEmail(), updatedAt: Date.now() };
      await db.collection('environments').doc(env.id).set(data);
    } catch (err) {
      console.error('Error saving environment:', err);
    }
  },

  async deleteEnvironment(id) {
    if (!this._ready) return;
    try {
      await db.collection('environments').doc(id).delete();
    } catch (err) {
      console.error('Error deleting environment:', err);
    }
  },

  // Upload all local data to cloud (first-time sync)
  async pushAllLocal() {
    this._updateStatus('syncing');
    try {
      const collections = Collections.getAll();
      for (const col of collections) {
        await this.saveCollection(col);
        if (col.items) {
          await this._pushRequests(col.items);
        }
      }
      const environments = Environments.getAll();
      for (const env of environments) {
        await this.saveEnvironment(env);
      }
      this._updateStatus('synced');
    } catch (err) {
      console.error('Error pushing local data:', err);
      this._updateStatus('error');
    }
  },

  async _pushRequests(items) {
    for (const item of items) {
      if (item.type === 'request') {
        const req = Collections.getRequest(item.id);
        if (req) await this.saveRequest(req);
      }
      if (item.items) {
        await this._pushRequests(item.items);
      }
    }
  }
};
