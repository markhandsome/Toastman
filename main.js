// ===== Desktop App - Electron Main Process =====

const { app, BrowserWindow, session, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 54321;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Domains that should NOT have Origin/Referer stripped (auth, Firebase, Google)
const AUTH_DOMAINS = [
  'accounts.google.com',
  'googleapis.com',
  'firebaseapp.com',
  'firebaseio.com',
  'firebase.googleapis.com',
  'securetoken.googleapis.com',
  'identitytoolkit.googleapis.com',
  'www.googleapis.com',
  'apis.google.com',
  'gstatic.com'
];

function isAuthDomain(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname;
    return AUTH_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function startLocalServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url);
      const pathname = decodeURIComponent(parsed.pathname);
      let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
      });
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Local server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'API Client',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#0a0e1a'
  });

  // Allow Google OAuth popups to open properly
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    // Let Firebase/Google auth popups open inside Electron
    if (openUrl.includes('accounts.google.com') ||
        openUrl.includes('firebaseapp.com') ||
        openUrl.includes('googleapis.com')) {
      return { action: 'allow' };
    }
    // Open other links in system browser
    shell.openExternal(openUrl);
    return { action: 'deny' };
  });

  win.loadURL(`http://localhost:${PORT}`);
}

// Allow self-signed certs for localhost APIs
app.commandLine.appendSwitch('ignore-certificate-errors');

app.on('ready', async () => {
  await startLocalServer();

  const ses = session.defaultSession;

  // Inject CORS headers on API responses (skip auth/Firebase domains)
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };

    // Don't modify auth/Firebase responses — they need their original headers
    if (!isAuthDomain(details.url)) {
      headers['access-control-allow-origin'] = ['*'];
      headers['access-control-allow-methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'];
      headers['access-control-allow-headers'] = ['*'];
      headers['access-control-expose-headers'] = ['*'];
      headers['access-control-allow-credentials'] = ['true'];
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
    }

    callback({ responseHeaders: headers });
  });

  // Strip Origin/Referer only for user API requests (not auth/Firebase)
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };

    const isLocal = details.url.startsWith(`http://localhost:${PORT}`);
    const isAuth = isAuthDomain(details.url);

    // Only strip Origin/Referer for user API calls (not local app, not auth)
    if (!isLocal && !isAuth) {
      delete headers['Origin'];
      delete headers['Referer'];
    }

    callback({ requestHeaders: headers });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
