// Local dev server: serves the static site + /api/ai-screen (mirrors Vercel).
// Not used in production. Run: node dev-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const aiScreen = require('./api/ai-screen.js');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/ai-screen') return aiScreen(req, res);
  let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end('forbidden'); }
  if (url.pathname === '/' || !path.extname(p)) p = path.join(ROOT, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
});
server.listen(8000, '0.0.0.0', () => console.log('Dev server on :8000 (static + /api/ai-screen)'));
