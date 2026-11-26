import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  plugins: [vue(), pwaServiceWorker()],
  resolve: { alias: [{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }] },
  build: { chunkSizeWarningLimit: 1000 },
  server: { port: 5174 }
});
