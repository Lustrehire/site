// Local, read-only server: no backend and no extra server dependency.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const preview = process.env.LUSTRE_DESIGN_PREVIEW === '1';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  // The new public documents have clean canonical routes. Mirror the intended
  // host mapping locally, without a catch-all that hides missing files.
  const cleanRoute = pathname.match(/^\/(gallery|faq)(?:\.html|\/)?$/);
  if (cleanRoute && pathname.endsWith('/')) {
    const query = new URL(req.url, 'http://localhost').search;
    res.writeHead(308, { Location: '/' + cleanRoute[1] + query }).end();
    return;
  }
  const routeFile = cleanRoute ? `/${cleanRoute[1]}.html` : pathname;
  const file = path.resolve(root, '.' + decodeURIComponent(routeFile === '/' ? '/index.html' : routeFile));
  if (!file.startsWith(root + path.sep) || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' };
    if (preview && path.extname(file) === '.html') {
      // Allow existing visual assets, but block all tracking scripts, API calls,
      // remote frames and native form submissions independently of the mocks.
      headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https://i.imgur.com; form-action 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'";
      data = Buffer.from(data.toString().replace('<head>', '<head><script src="/scripts/preview-mocks.js"></script>'));
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(preview ? 4174 : 4173, '127.0.0.1');
