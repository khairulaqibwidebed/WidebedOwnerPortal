import { createApp } from 'vue';
import App from './App.vue';
import router from './router.js';
import './app.css';

createApp(App).use(router).mount('#app');

// PWA: the service worker keeps the app's own files so it opens offline. A new version waits for "Reload" on the bar.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      const show = w => window.dispatchEvent(new CustomEvent('wb-update', { detail: w }));
      if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); });
      });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  });
}
