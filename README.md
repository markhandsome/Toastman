# API Client made by claude

A Postman-style API testing tool built with pure HTML/CSS/JS. Features team collaboration via Firebase, real-time sync, and an Electron desktop app with built-in CORS bypass.

![Desktop App](https://img.shields.io/badge/platform-Windows-blue) ![Firebase](https://img.shields.io/badge/backend-Firebase-orange) ![License](https://img.shields.io/badge/license-ISC-green)

## Features

- **Request Builder** - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Params, Headers, Body, Auth** - Full request configuration with form-data, x-www-form-urlencoded, raw JSON/XML/text
- **Authentication** - Bearer Token, Basic Auth, API Key (header or query)
- **Environment Variables** - Create environments with `{{variable}}` substitution (highlighted in URL bar)
- **Collections & Folders** - Organize requests into collections with nested folders
- **Pre-request & Test Scripts** - JavaScript scripting with `pm.environment`, `pm.test()`, `pm.expect()`
- **Response Viewer** - Pretty-printed JSON, raw text, HTML preview, response headers
- **Team Sync** - Real-time collaboration via Firebase Firestore, scoped by project
- **Project-based Access** - Invite team members by Gmail, role-based permissions (owner/admin/member)
- **Import/Export** - Postman v2.1 collection import, native JSON export
- **History** - Auto-logged request history (last 100)
- **Desktop App** - Electron wrapper with no CORS restrictions
- **CORS Proxy** - Built-in Node.js proxy for web version localhost testing

## Quick Start

### Desktop App (Recommended)

```bash
# Install dependencies
npm install

# Run the app
npm start
```

### Web Version

Serve the files with any static server, or deploy to Render/Vercel/Netlify.

### Build Installer (.exe)

```bash
npm run build
# Output: dist/API Client Setup 1.0.0.exe
```

## Setup

### 1. Firebase

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** > **Google Sign-In**
3. Enable **Cloud Firestore** (start in test mode or use rules below)
4. Add `localhost` to **Authentication** > **Settings** > **Authorized domains**
5. Copy your config into `js/firebase-config.js`:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 2. Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. CORS Proxy (Web Version Only)

If using the web version and testing localhost APIs:

```bash
node proxy.js
# Toggle "Proxy" in the app's top bar
```

The desktop app bypasses CORS automatically - no proxy needed.

## Project Structure

```
.
├── index.html            # Main app HTML
├── main.js               # Electron main process
├── proxy.js              # CORS proxy server
├── package.json          # Dependencies & build config
├── render.yaml           # Render deployment config
├── _headers              # MIME type headers for Render
├── css/
│   └── style.css         # Complete dark theme styles
└── js/
    ├── firebase-config.js  # Firebase credentials (configure this)
    ├── app.js              # Main orchestrator, tabs, request flow
    ├── auth.js             # Google Sign-In
    ├── collections.js      # Collection/folder/request CRUD
    ├── environments.js     # Environment variable management
    ├── history.js          # Request history log
    ├── projects.js         # Project & team management
    ├── request.js          # HTTP request engine
    ├── storage.js          # localStorage wrapper
    ├── sync.js             # Firestore real-time sync
    └── ui.js               # UI rendering & components
```

## Scripting API

### Pre-request Script

```js
// Set environment variable
pm.environment.set('timestamp', Date.now());
pm.environment.set('token', 'abc123');

// Read environment variable
const baseUrl = pm.environment.get('base_url');
```

### Test Script

```js
pm.test('Status is 200', () => pm.response.status === 200);

pm.test('Response has data', () => {
  const json = pm.response.json();
  return json && json.data;
});

pm.test('Response time < 500ms', () => pm.response.time < 500);

// Save response data to environment
const token = pm.response.json().token;
pm.environment.set('auth_token', token);
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send request |
| `Ctrl+S` | Save request |
| `Ctrl+N` | New tab |
| `Ctrl+W` | Close tab |

## License

ISC
