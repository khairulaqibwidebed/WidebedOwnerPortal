import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Local test: runs api/*.js inside `npm run dev` the way Vercel runs them on the live site.
// Put the variables in .env.local next to package.json (never committed): the five names from SETUP.md, plus PMS_ADMIN_JSON,
// PORTAL_ADMIN_JSON and the Drive ones. Each service account JSON must be on ONE line.
function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      const file = resolve(process.cwd(), '.env.local');
      if (existsSync(file)) {
        // A service account JSON may be pasted over several lines: keep reading until its braces close.
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
          if (!m || line.trim().startsWith('#')) continue;
          let value = m[2];
          const depth = t => (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length;
          if (value.startsWith('{')) { let d = depth(value); while (d > 0 && i + 1 < lines.length) { value += lines[++i].trim(); d = depth(value); } }
          process.env[m[1]] = value.replace(/^(['"])([\s\S]*)\1$/, '$2');
        }
        // Names and lengths only, never the values
        const keys = ['PORTAL_FIREBASE_API_KEY', 'PORTAL_ADMIN_JSON', 'PMS_ADMIN_JSON', 'DRIVE_SCRIPT_URL', 'DRIVE_SCRIPT_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'DRIVE_ROOT_FOLDER_ID'];
        console.log('[api] ' + keys.map(k => `${k}: ${process.env[k] ? process.env[k].length + ' chars' : 'MISSING'}`).join(' | '));
      } else console.warn('[api] .env.local not found next to package.json: the server functions will say their settings are missing.');
      server.middlewares.use(async (req, res, next) => {
        const name = /^\/api\/(portal|register|file)(\?|$)/.exec(req.url || '')?.[1];
        if (!name) return next();
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', async () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            req.body = raw ? JSON.parse(raw) : {};
            res.status = code => { res.statusCode = code; return res; };
            res.json = obj => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
            const mod = await server.ssrLoadModule(`/api/${name}.js`);   // reloaded when the file changes
            await mod.default(req, res);
          } catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: e.message || 'Local function failed.' })); }
        });
      });
    }
  };
}

// PWA: writes sw.js into the build with a new version each build, so phones see "New version available".
// It keeps only the app's own files (code, styles, icons). It never touches /api, Firebase or Google Drive, so
// nobody is ever shown old or someone else's data.
function pwaServiceWorker() {
  return {
    name: 'pwa-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      let source = readFileSync(resolve(process.cwd(), 'pwa/sw.template.js'), 'utf8');
      const files = Object.values(bundle)
        .filter(f => (f.type === 'chunk' && f.isEntry) || (f.type === 'asset' && /\.css$/.test(f.fileName)))
        .map(f => '/' + f.fileName);
      const version = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      source = source.replaceAll('__VERSION__', version)
        .replaceAll('__PRECACHE__', JSON.stringify(['/index.html', '/manifest.webmanifest', '/icons/icon-192.png', ...files]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    }
  };
}

export default defineConfig({
  plugins: [vue(), localApi(), pwaServiceWorker()],
  resolve: { alias: [{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }] },
  build: { chunkSizeWarningLimit: 1000 },
  server: { port: 5174 }
});
