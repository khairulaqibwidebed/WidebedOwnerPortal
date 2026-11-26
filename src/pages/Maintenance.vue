<template>
  <div>
  <Loader :loading="loading" :error="error" @retry="load">
    <h1 class="page-h">Maintenance</h1>
    <p class="page-sub">Maintenance for your units and how far along each job is.</p>
    <div v-if="!tickets.length" class="empty">No maintenance jobs to show.</div>
    <div class="grid"><div v-for="t in tickets" :key="t.id" class="card stripe" :class="cls(t.status)">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div class="title">{{ t.title }}</div>
        <span class="chip" :class="cls(t.status)">{{ t.status }}</span>
      </div>
      <div class="sub" style="margin:2px 0 0">{{ t.unit }} · {{ t.property }}<template v-if="t.date"> · {{ dmy(t.date) }}</template></div>
      <button v-if="t.hasFiles && !t.files" class="btn small ghost" style="margin-top:10px" :disabled="t.busy" @click="open(t)">{{ t.busy ? 'Loading…' : 'View photos and videos' }}</button>
      <div v-if="t.files && !t.files.length" class="hint">No photos or videos.</div>
      <div v-if="t.files && t.files.length" class="media">
        <button v-for="(f, n) in t.files" :key="f.id" class="thumb" type="button" :aria-label="f.name" @click="view = { items: t.files, start: n }">
          <video v-if="f.mimeType.startsWith('video/')" :src="f.url + '#t=0.1'" preload="metadata" muted playsinline></video>
          <img v-else :src="f.url" :alt="f.name" loading="lazy" />
          <span v-if="f.mimeType.startsWith('video/')" class="play">▶</span>
        </button>
      </div>
      <div v-if="t.err" class="err">{{ t.err }}</div>
    </div></div>
  </Loader>
  <Viewer v-if="view" :items="view.items" :start="view.start" @close="view = null" />
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import Viewer from '@/components/Viewer.vue';
import { call, fileUrl } from '@/lib/api.js';
import { dmy } from '@/lib/format.js';
export default {
  components: { Loader, Viewer },
  data() { return { loading: true, error: '', tickets: [], view: null, dmy }; },
  mounted() { this.load(); },
  methods: {
    cls: s => (s === 'Completed' ? 'green' : s === 'In progress' ? 'amber' : ''),
    async load() { this.loading = true; this.error = ''; try { this.tickets = (await call('tickets')).tickets; } catch (e) { this.error = e.message; } finally { this.loading = false; } },
    async open(t) {
      t.err = ''; t.busy = true;
      try {
        const { files } = await call('ticketFiles', { id: t.id });
        t.files = await Promise.all(files.map(async f => ({ ...f, url: await fileUrl('ticket', t.id, f.id) })));
      } catch (e) { t.err = e.message; }
      finally { t.busy = false; }
    }
  }
};
</script>
