// ===== Environments Module =====

const Environments = {
  create(name) {
    const env = {
      id: Storage.uuid(),
      name: name || 'New Environment',
      variables: [{ key: '', value: '', enabled: true }],
      createdAt: Date.now()
    };
    Storage.set('environments', env.id, env);
    Sync.saveEnvironment(env);
    return env;
  },

  get(id) {
    return Storage.get('environments', id);
  },

  update(id, data) {
    const env = this.get(id);
    if (!env) return null;
    Object.assign(env, data, { updatedAt: Date.now() });
    Storage.set('environments', env.id, env);
    Sync.saveEnvironment(env);
    return env;
  },

  delete(id) {
    Storage.delete('environments', id);
    Sync.deleteEnvironment(id);
    if (this.getActiveId() === id) {
      this.setActive('');
    }
  },

  getAll() {
    return Storage.getAll('environments').sort((a, b) => a.createdAt - b.createdAt);
  },

  getActiveId() {
    return Storage.getSetting('activeEnv') || '';
  },

  setActive(id) {
    Storage.setSetting('activeEnv', id);
  },

  getActive() {
    const id = this.getActiveId();
    return id ? this.get(id) : null;
  },

  // Build a variable map from active environment
  getVariableMap() {
    const env = this.getActive();
    if (!env) return {};
    const map = {};
    (env.variables || []).forEach(v => {
      if (v.enabled && v.key) {
        map[v.key] = v.value;
      }
    });
    return map;
  },

  // Replace {{var}} placeholders in a string
  resolve(str, extraVars) {
    if (!str || typeof str !== 'string') return str;
    const vars = { ...this.getVariableMap(), ...extraVars };
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return vars[key] !== undefined ? vars[key] : match;
    });
  }
};