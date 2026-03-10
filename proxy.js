// ===== CORS Proxy =====
// Run this to bypass CORS when testing localhost APIs
// Usage: node proxy.js

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8787;

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Target URL is passed as query param: /proxy?url=http://localhost:3000/api
  const parsed = url.parse(req.url, true);
  const targetUrl = parsed.query.url;

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    return;
  }

  // Parse target
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL: ' + targetUrl }));
    return;
  }

  // Forward all headers except host
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders.origin;
  delete forwardHeaders.referer;

  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    method: req.method,
    headers: forwardHeaders
  };

  const lib = target.protocol === 'https:' ? https : http;

  const proxyReq = lib.request(options, (proxyRes) => {
    // Forward status and headers
    const headers = { ...proxyRes.headers };
    // Override CORS headers
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-methods'] = '*';
    headers['access-control-allow-headers'] = '*';
    headers['access-control-expose-headers'] = '*';

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
  });

  // Forward request body
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`\n  CORS Proxy running on http://localhost:${PORT}`);
  console.log(`  All requests will be forwarded with CORS headers\n`);
  console.log(`  Enable "CORS Proxy" in the app to use this\n`);
});
