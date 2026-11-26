<template>
  <div v-if="!ready" class="boot" aria-busy="true"><div class="card sk-card"><div class="sk sk-title"></div><div class="sk sk-sub"></div><div class="sk-row"><div class="sk sk-l"></div><div class="sk sk-r"></div></div></div></div>
  <template v-else>
    <div v-if="!online" class="bar offline">You're offline. Pages you already opened may be out of date.</div>
    <div v-if="update" class="bar update">A new version is ready. <button class="link-btn" @click="reload">Reload</button></div>
    <div v-if="!configured" class="bar offline">This site is not connected to its Firebase project yet (VITE_FIREBASE_* settings are missing).</div>
    <template v-if="inApp">
      <header class="top">
        <img src="/favicon.svg" alt="" class="logo" />
        <div class="ttl">{{ $route.meta.title }}</div>
        <div class="brand desk">Widebed Owner</div>
        <nav class="topnav">
          <router-link v-for="t in tabs" :key="t.to" :to="t.to">{{ t.label }}</router-link>
        </nav>
      </header>
      <main class="page"><router-view /></main>
      <nav class="tabbar">
        <router-link v-for="t in tabs" :key="t.to" :to="t.to"><span class="ico" v-html="t.icon"></span><span>{{ t.short || t.label }}</span></router-link>
      </nav>
    </template>
    <main v-else class="page narrow"><router-view /></main>
  </template>
</template>

<script>
import { session } from '@/lib/session.js';
import { configured } from '@/firebase.js';

const I = p => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export default {
  data() {
    return { configured, online: navigator.onLine, update: null,
      tabs: [
        { to: '/units', label: 'Property and Units', short: 'Units', icon: I('<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/>') },
        { to: '/stays', label: 'Check-ins', short: 'Stays', icon: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
        { to: '/payments', label: 'Payments', icon: I('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>') },
        { to: '/maintenance', label: 'Maintenance', short: 'Repairs', icon: I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>') },
        { to: '/profile', label: 'Profile', icon: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>') }
      ] };
  },
  computed: {
    ready() { return session.ready; },
    inApp() { return !!session.user && session.verified; }
  },
  mounted() {
    window.addEventListener('online', () => (this.online = true));
    window.addEventListener('offline', () => (this.online = false));
    window.addEventListener('wb-update', e => (this.update = e.detail));
  },
  methods: { reload() { this.update?.postMessage('skipWaiting'); } }
};
</script>
