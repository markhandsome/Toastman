// ===== Storage Module =====
// Thin localStorage wrapper with namespaced keys

const Storage = {
  PREFIX: 'apiclient_',

  _key(namespace, id) {
    return `${this.PREFIX}${namespace}_${id}`;
  },

  get(namespace, id) {
    try {
      const raw = localStorage.getItem(this._key(namespace, id));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  set(namespace, id, value) {
    try {
      localStorage.setItem(this._key(namespace, id), JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded');
      }
      return false;
    }
  },

  delete(namespace, id) {
    localStorage.removeItem(this._key(namespace, id));
  },

  getAll(namespace) {
    const prefix = `${this.PREFIX}${namespace}_`;
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) {
        try {
          items.push(JSON.parse(localStorage.getItem(key)));
        } catch { /* skip corrupt entries */ }
      }
    }
    return items;
  },

  clear(namespace) {
    const prefix = `${this.PREFIX}${namespace}_`;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  },

  // Clear project-specific data (collections, requests, environments) but keep settings
  clearProjectData() {
    this.clear('collections');
    this.clear('requests');
    this.clear('environments');
  },

  // Simple key-value for settings
  getSetting(key) {
    try {
      const raw = localStorage.getItem(`${this.PREFIX}setting_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSetting(key, value) {
    localStorage.setItem(`${this.PREFIX}setting_${key}`, JSON.stringify(value));
  },

  exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.PREFIX)) {
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  },

  importAll(data) {
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith(this.PREFIX)) {
        localStorage.setItem(key, value);
      }
    });
  },

  uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
};