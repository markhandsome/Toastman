// ===== Request Engine Module =====

const RequestEngine = {
  // Build full URL with query params
  buildUrl(url, params) {
    if (!url) return '';
    try {
      // Handle missing protocol — use http for localhost, https for everything else
      let fullUrl = url;
      if (!/^https?:\/\//i.test(fullUrl)) {
        const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(fullUrl);
        fullUrl = (isLocal ? 'http://' : 'https://') + fullUrl;
      }

      const urlObj = new URL(fullUrl);
      if (params && params.length) {
        params.forEach(p => {
          if (p.enabled && p.key) {
            urlObj.searchParams.append(p.key, p.value || '');
          }
        });
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  },

  // Build headers object
  buildHeaders(headers, auth, bodyMode) {
    const h = {};

    // Add user headers
    if (headers) {
      headers.forEach(item => {
        if (item.enabled && item.key) {
          h[item.key] = item.value || '';
        }
      });
    }

    // Add auth headers
    if (auth) {
      switch (auth.type) {
        case 'bearer':
          if (auth.bearer && auth.bearer.token) {
            h['Authorization'] = `Bearer ${auth.bearer.token}`;
          }
          break;
        case 'basic':
          if (auth.basic && auth.basic.username) {
            const encoded = btoa(`${auth.basic.username}:${auth.basic.password || ''}`);
            h['Authorization'] = `Basic ${encoded}`;
          }
          break;
        case 'apikey':
          if (auth.apikey && auth.apikey.addTo === 'header' && auth.apikey.key) {
            h[auth.apikey.key] = auth.apikey.value || '';
          }
          break;
      }
    }

    // Content-Type based on body mode
    if (bodyMode === 'raw' && !h['Content-Type']) {
      h['Content-Type'] = 'application/json';
    } else if (bodyMode === 'x-www-form-urlencoded' && !h['Content-Type']) {
      h['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    // form-data: let the browser set the Content-Type with boundary

    return h;
  },

  // Build request body
  buildBody(body) {
    if (!body || body.mode === 'none') return undefined;

    switch (body.mode) {
      case 'raw':
        return body.raw || '';
      case 'form-data': {
        const fd = new FormData();
        if (body.formData) {
          body.formData.forEach(item => {
            if (item.enabled && item.key) {
              fd.append(item.key, item.value || '');
            }
          });
        }
        return fd;
      }
      case 'x-www-form-urlencoded': {
        const params = new URLSearchParams();
        if (body.urlencoded) {
          body.urlencoded.forEach(item => {
            if (item.enabled && item.key) {
              params.append(item.key, item.value || '');
            }
          });
        }
        return params.toString();
      }
      default:
        return undefined;
    }
  },

  // Substitute env variables in all parts of the request
  resolveRequest(req) {
    const resolved = JSON.parse(JSON.stringify(req));
    resolved.url = Environments.resolve(resolved.url);

    if (resolved.params) {
      resolved.params.forEach(p => {
        p.key = Environments.resolve(p.key);
        p.value = Environments.resolve(p.value);
      });
    }
    if (resolved.headers) {
      resolved.headers.forEach(h => {
        h.key = Environments.resolve(h.key);
        h.value = Environments.resolve(h.value);
      });
    }
    if (resolved.body) {
      if (resolved.body.raw) {
        resolved.body.raw = Environments.resolve(resolved.body.raw);
      }
      if (resolved.body.formData) {
        resolved.body.formData.forEach(f => {
          f.key = Environments.resolve(f.key);
          f.value = Environments.resolve(f.value);
        });
      }
      if (resolved.body.urlencoded) {
        resolved.body.urlencoded.forEach(u => {
          u.key = Environments.resolve(u.key);
          u.value = Environments.resolve(u.value);
        });
      }
    }
    if (resolved.auth) {
      if (resolved.auth.bearer) {
        resolved.auth.bearer.token = Environments.resolve(resolved.auth.bearer.token);
      }
      if (resolved.auth.basic) {
        resolved.auth.basic.username = Environments.resolve(resolved.auth.basic.username);
        resolved.auth.basic.password = Environments.resolve(resolved.auth.basic.password);
      }
      if (resolved.auth.apikey) {
        resolved.auth.apikey.key = Environments.resolve(resolved.auth.apikey.key);
        resolved.auth.apikey.value = Environments.resolve(resolved.auth.apikey.value);
      }
    }
    return resolved;
  },

  // Add API key to query params if configured
  addApiKeyParam(params, auth) {
    if (auth && auth.type === 'apikey' && auth.apikey && auth.apikey.addTo === 'query' && auth.apikey.key) {
      params = params ? [...params] : [];
      params.push({ key: auth.apikey.key, value: auth.apikey.value || '', enabled: true });
    }
    return params;
  },

  // Execute the HTTP request
  async send(requestObj, signal) {
    const resolved = this.resolveRequest(requestObj);
    const method = resolved.method || 'GET';
    const bodyMode = resolved.body ? resolved.body.mode : 'none';

    // Build params (with API key if needed)
    let params = resolved.params || [];
    params = this.addApiKeyParam(params, resolved.auth);

    const url = this.buildUrl(resolved.url, params);
    const headers = this.buildHeaders(resolved.headers, resolved.auth, bodyMode);

    // Don't send body for GET/HEAD
    const hasBody = !['GET', 'HEAD'].includes(method);
    const body = hasBody ? this.buildBody(resolved.body) : undefined;

    // Remove Content-Type for form-data (browser sets boundary)
    if (bodyMode === 'form-data') {
      delete headers['Content-Type'];
    }

    // Route through CORS proxy if enabled (not needed in Electron desktop)
    let fetchUrl = url;
    const isElectron = navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) {
      const proxyEnabled = Storage.getSetting('corsProxy');
      if (proxyEnabled) {
        const proxyUrl = Storage.getSetting('corsProxyUrl') || 'http://localhost:8787/proxy';
        fetchUrl = proxyUrl + '?url=' + encodeURIComponent(url);
      }
    }

    const startTime = performance.now();

    const fetchOptions = {
      method,
      headers,
      body,
      redirect: 'follow',
      signal: signal || undefined
    };

    const response = await fetch(fetchUrl, fetchOptions);
    const endTime = performance.now();
    const elapsed = Math.round(endTime - startTime);

    const respHeaders = {};
    response.headers.forEach((value, key) => {
      respHeaders[key] = value;
    });

    const responseText = await response.text();
    const size = new Blob([responseText]).size;

    return {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
      body: responseText,
      time: elapsed,
      size: size,
      ok: response.ok
    };
  }
};
