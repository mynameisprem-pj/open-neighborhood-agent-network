import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const SITES = [
  { name: 'Neighborhood Hub', dir: 'sites/hub', port: 4100 },
  { name: 'Hearth & Crumb (Food)', dir: 'sites/food-restaurant', port: 4101 },
  { name: 'CivicFix (Local Services)', dir: 'sites/local-services', port: 4102 },
  { name: 'Oakwood Booking (Appointments)', dir: 'sites/appointments-booking', port: 4103 }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function startSiteServer({ name, dir, port }) {
  const siteRoot = path.join(ROOT_DIR, dir);
  const packagesRoot = path.join(ROOT_DIR, 'packages');

  const server = http.createServer(async (req, res) => {
    // Enable CORS for cross-origin Open Agentic Web manifest & network discovery
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlObj = new URL(req.url || '/', `http://localhost:${port}`);
    let pathname = decodeURIComponent(urlObj.pathname);
    if (pathname === '/') pathname = '/index.html';

    // Allow clean browser ESM imports from /packages/* across all 4 origins
    let targetPath;
    if (pathname.startsWith('/packages/')) {
      targetPath = path.resolve(ROOT_DIR, '.' + pathname);
      if (!targetPath.startsWith(packagesRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    } else {
      targetPath = path.resolve(siteRoot, '.' + pathname);
      if (!targetPath.startsWith(siteRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    }

    try {
      const stat = await fs.stat(targetPath);
      const finalPath = stat.isDirectory() ? path.join(targetPath, 'index.html') : targetPath;
      const data = await fs.readFile(finalPath);
      const ext = path.extname(finalPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Not found', origin: name, path: pathname }));
    }
  });

  server.listen(port, () => {
    const hostLabel = port === 4100 ? '127.0.0.1' : 'localhost';
    console.log(`  ✔ ${name.padEnd(32)} -> http://${hostLabel}:${port}`);
  });
}

console.log('\n🌐 Starting Open Neighborhood Agent Network (4 Independent Origins)...\n');
for (const site of SITES) {
  startSiteServer(site);
}
console.log('\nPress Ctrl+C to stop all servers.\n');
