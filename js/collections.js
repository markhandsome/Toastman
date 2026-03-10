// ===== Collections Module =====

const Collections = {
  create(name) {
    const col = {
      id: Storage.uuid(),
      name: name || 'New Collection',
      items: [], // array of { type: 'folder'|'request', id, name, items? }
      createdAt: Date.now()
    };
    Storage.set('collections', col.id, col);
    Sync.saveCollection(col);
    return col;
  },

  get(id) {
    return Storage.get('collections', id);
  },

  update(id, data) {
    const col = this.get(id);
    if (!col) return null;
    Object.assign(col, data);
    Storage.set('collections', col.id, col);
    Sync.saveCollection(col);
    return col;
  },

  delete(id) {
    const col = this.get(id);
    if (col) {
      // Delete all requests in this collection
      this._forEachRequest(col.items, reqId => {
        Storage.delete('requests', reqId);
        Sync.deleteRequest(reqId);
      });
    }
    Storage.delete('collections', id);
    Sync.deleteCollection(id);
  },

  getAll() {
    return Storage.getAll('collections').sort((a, b) => a.createdAt - b.createdAt);
  },

  // Add a folder to collection root
  addFolder(collectionId, name) {
    const col = this.get(collectionId);
    if (!col) return null;
    const folder = {
      type: 'folder',
      id: Storage.uuid(),
      name: name || 'New Folder',
      items: []
    };
    col.items.push(folder);
    this.update(collectionId, { items: col.items });
    return folder;
  },

  // Save a request to a collection
  saveRequest(collectionId, folderId, request) {
    // Store request data
    if (!request.id) request.id = Storage.uuid();
    request.collectionId = collectionId;
    request.updatedAt = Date.now();
    if (!request.createdAt) request.createdAt = Date.now();
    Storage.set('requests', request.id, request);
    Sync.saveRequest(request);

    // Add reference to collection
    const col = this.get(collectionId);
    if (!col) return request;

    const ref = { type: 'request', id: request.id };

    if (folderId) {
      const folder = this._findFolder(col.items, folderId);
      if (folder) {
        // Check if already in folder
        if (!folder.items.some(i => i.id === request.id)) {
          folder.items.push(ref);
        }
      }
    } else {
      if (!col.items.some(i => i.type === 'request' && i.id === request.id)) {
        col.items.push(ref);
      }
    }

    this.update(collectionId, { items: col.items });
    return request;
  },

  // Get request data
  getRequest(id) {
    return Storage.get('requests', id);
  },

  // Update request data (not collection structure)
  updateRequest(request) {
    request.updatedAt = Date.now();
    Storage.set('requests', request.id, request);
    Sync.saveRequest(request);
    return request;
  },

  // Delete a request
  deleteRequest(collectionId, requestId) {
    Storage.delete('requests', requestId);
    Sync.deleteRequest(requestId);
    const col = this.get(collectionId);
    if (col) {
      col.items = this._removeItem(col.items, requestId);
      this.update(collectionId, { items: col.items });
    }
  },

  // Delete a folder
  deleteFolder(collectionId, folderId) {
    const col = this.get(collectionId);
    if (!col) return;
    const folder = this._findFolder(col.items, folderId);
    if (folder) {
      // Delete all requests in folder
      folder.items.forEach(item => {
        if (item.type === 'request') {
          Storage.delete('requests', item.id);
        }
      });
    }
    col.items = this._removeItem(col.items, folderId);
    this.update(collectionId, { items: col.items });
  },

  // Rename an item
  renameItem(collectionId, itemId, newName) {
    const col = this.get(collectionId);
    if (!col) return;
    // Check if it's the collection itself
    if (collectionId === itemId) {
      this.update(collectionId, { name: newName });
      return;
    }
    // Find in items tree
    const item = this._findItem(col.items, itemId);
    if (item) {
      item.name = newName;
      this.update(collectionId, { items: col.items });
    }
    // Also check if it's a request
    const req = this.getRequest(itemId);
    if (req) {
      req.name = newName;
      this.updateRequest(req);
    }
  },

  // Duplicate a request
  duplicateRequest(collectionId, requestId, folderId) {
    const original = this.getRequest(requestId);
    if (!original) return null;
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = Storage.uuid();
    copy.name = `${copy.name} (copy)`;
    copy.createdAt = Date.now();
    return this.saveRequest(collectionId, folderId, copy);
  },

  // Export collection as JSON
  exportCollection(collectionId) {
    const col = this.get(collectionId);
    if (!col) return null;

    const exportData = {
      _type: 'api_client_collection',
      _version: '1.0',
      collection: {
        name: col.name,
        items: this._exportItems(col.items)
      }
    };
    return exportData;
  },

  // Import collection from JSON
  importCollection(jsonData) {
    if (!jsonData || jsonData._type !== 'api_client_collection') {
      // Try Postman format
      return this._importPostmanFormat(jsonData);
    }

    const col = this.create(jsonData.collection.name);
    if (jsonData.collection.items) {
      col.items = this._importItems(jsonData.collection.items, col.id);
      this.update(col.id, { items: col.items });
    }
    return col;
  },

  // --- Private helpers ---

  _findFolder(items, folderId) {
    for (const item of items) {
      if (item.type === 'folder' && item.id === folderId) return item;
      if (item.type === 'folder' && item.items) {
        const found = this._findFolder(item.items, folderId);
        if (found) return found;
      }
    }
    return null;
  },

  _findItem(items, itemId) {
    for (const item of items) {
      if (item.id === itemId) return item;
      if (item.items) {
        const found = this._findItem(item.items, itemId);
        if (found) return found;
      }
    }
    return null;
  },

  _removeItem(items, itemId) {
    return items.filter(item => {
      if (item.id === itemId) return false;
      if (item.items) {
        item.items = this._removeItem(item.items, itemId);
      }
      return true;
    });
  },

  _forEachRequest(items, callback) {
    items.forEach(item => {
      if (item.type === 'request') callback(item.id);
      if (item.items) this._forEachRequest(item.items, callback);
    });
  },

  _exportItems(items) {
    return items.map(item => {
      if (item.type === 'folder') {
        return {
          type: 'folder',
          name: item.name,
          items: this._exportItems(item.items || [])
        };
      } else {
        const req = this.getRequest(item.id);
        if (!req) return null;
        return {
          type: 'request',
          name: req.name,
          method: req.method,
          url: req.url,
          params: req.params,
          headers: req.headers,
          body: req.body,
          auth: req.auth
        };
      }
    }).filter(Boolean);
  },

  _importItems(items, collectionId) {
    return items.map(item => {
      if (item.type === 'folder') {
        return {
          type: 'folder',
          id: Storage.uuid(),
          name: item.name,
          items: this._importItems(item.items || [], collectionId)
        };
      } else {
        const req = {
          id: Storage.uuid(),
          collectionId,
          name: item.name || 'Untitled',
          method: item.method || 'GET',
          url: item.url || '',
          params: item.params || [],
          headers: item.headers || [],
          body: item.body || { mode: 'none', raw: '', formData: [], urlencoded: [] },
          auth: item.auth || { type: 'none' },
          createdAt: Date.now()
        };
        Storage.set('requests', req.id, req);
        return { type: 'request', id: req.id };
      }
    });
  },

  _importPostmanFormat(data) {
    // Basic Postman v2.1 collection import
    if (!data || !data.info || !data.item) return null;

    const col = this.create(data.info.name || 'Imported Collection');
    col.items = this._importPostmanItems(data.item, col.id);
    this.update(col.id, { items: col.items });
    return col;
  },

  _importPostmanItems(items, collectionId) {
    return items.map(item => {
      if (item.item) {
        // It's a folder
        return {
          type: 'folder',
          id: Storage.uuid(),
          name: item.name,
          items: this._importPostmanItems(item.item, collectionId)
        };
      } else if (item.request) {
        // It's a request
        const r = item.request;
        const url = typeof r.url === 'string' ? r.url : (r.url && r.url.raw ? r.url.raw : '');
        const headers = (r.header || []).map(h => ({
          key: h.key, value: h.value, enabled: !h.disabled
        }));

        let body = { mode: 'none', raw: '', formData: [], urlencoded: [] };
        if (r.body) {
          body.mode = r.body.mode || 'none';
          body.raw = r.body.raw || '';
          body.formData = (r.body.formdata || []).map(f => ({
            key: f.key, value: f.value, enabled: !f.disabled
          }));
          body.urlencoded = (r.body.urlencoded || []).map(u => ({
            key: u.key, value: u.value, enabled: !u.disabled
          }));
        }

        const auth = { type: 'none' };
        if (r.auth) {
          auth.type = r.auth.type || 'none';
          if (r.auth.bearer) {
            auth.bearer = { token: r.auth.bearer[0]?.value || '' };
          }
          if (r.auth.basic) {
            const basicArr = r.auth.basic || [];
            auth.basic = {
              username: basicArr.find(b => b.key === 'username')?.value || '',
              password: basicArr.find(b => b.key === 'password')?.value || ''
            };
          }
        }

        const req = {
          id: Storage.uuid(),
          collectionId,
          name: item.name || 'Untitled',
          method: r.method || 'GET',
          url,
          params: [],
          headers,
          body,
          auth,
          createdAt: Date.now()
        };
        Storage.set('requests', req.id, req);
        return { type: 'request', id: req.id };
      }
      return null;
    }).filter(Boolean);
  }
};