// ===== History Module =====

const History = {
  MAX_ENTRIES: 100,

  add(request, response) {
    const entry = {
      id: Storage.uuid(),
      request: {
        method: request.method,
        url: request.url,
        params: request.params,
        headers: request.headers,
        body: request.body,
        auth: request.auth
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        // Truncate large response bodies
        body: response.body && response.body.length > 100000
          ? response.body.substring(0, 100000) + '\n...[truncated]'
          : response.body,
        time: response.time,
        size: response.size,
        ok: response.ok
      },
      timestamp: Date.now()
    };

    Storage.set('history', entry.id, entry);
    this._trimOldEntries();
    return entry;
  },

  getAll() {
    return Storage.getAll('history').sort((a, b) => b.timestamp - a.timestamp);
  },

  get(id) {
    return Storage.get('history', id);
  },

  delete(id) {
    Storage.delete('history', id);
  },

  clear() {
    Storage.clear('history');
  },

  _trimOldEntries() {
    const all = this.getAll();
    if (all.length > this.MAX_ENTRIES) {
      const toRemove = all.slice(this.MAX_ENTRIES);
      toRemove.forEach(entry => Storage.delete('history', entry.id));
    }
  }
};