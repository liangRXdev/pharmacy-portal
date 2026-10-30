import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export async function startPharmacyServer(port = 0) {
  const root = path.resolve('public'), rules = [];
  for (const line of (await readFile('public/_headers', 'utf8')).split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
    else rules.at(-1).headers.push(line.trim());
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'), pathname = url.pathname;
      if (pathname === '/index.html' || pathname === '/pharmacy' || pathname === '/pharmacy/index.html') {
        res.writeHead(307, { location: (pathname === '/index.html' ? '/' : '/pharmacy/') + url.search }); res.end(); return;
      }
      const headers = {};
      for (const rule of rules) {
        if (!(rule.pattern.endsWith('*') ? pathname.startsWith(rule.pattern.slice(0, -1)) : pathname === rule.pattern)) continue;
        for (const line of rule.headers) {
          if (line.startsWith('! ')) { delete headers[line.slice(2).toLowerCase()]; continue; }
          const colon = line.indexOf(':');
          const key = line.slice(0, colon).toLowerCase(), value = line.slice(colon + 1).trim();
          headers[key] = headers[key] ? headers[key] + ', ' + value : value;
        }
      }
      let filename = path.resolve(root, '.' + decodeURIComponent(pathname));
      if (!filename.startsWith(root + path.sep) && filename !== root) throw new Error('path');
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
      res.writeHead(200, { ...headers, 'content-type': mime[path.extname(filename)] || 'text/plain' });
      res.end(await readFile(filename));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { base: `http://127.0.0.1:${server.address().port}`, server,
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
