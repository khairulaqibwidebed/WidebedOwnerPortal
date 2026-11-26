<template>
  <Loader :loading="loading" :error="error" @retry="load">
    <p class="sub">Maintenance for your units and how far along each job is.</p>
    <div v-if="!tickets.length" class="empty">No maintenance jobs to show.</div>
    <div v-for="t in tickets" :key="t.id" class="card">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div class="title">{{ t.title }}</div>
        <span class="chip" :class="cls(t.status)">{{ t.status }}</span>
      </div>
      <div class="sub" style="margin:2px 0 0">{{ t.unit }} · {{ t.property }}<template v-if="t.date"> · {{ dmy(t.date) }}</template></div>
      <button v-if="t.hasFiles && !t.files" class="btn small ghost" style="margin-top:10px" :disabled="t.busy" @click="open(t)">{{ t.busy ? 'Loading…' : 'View photos and videos' }}</button>
      <div v-if="t.files && !t.files.length" class="hint">No photos or videos.</div>
      <div v-if="t.files && t.files.length" class="media">
        <template v-for="f in t.files" :key="f.id">
          <video v-if="f.mimeType.startsWith('video/')" :src="f.url" controls playsinline preload="metadata"></video>
          <a v-else :href="f.url" target="_blank" rel="noopener"><img :src="f.url" :alt="f.name" loading="lazy" /></a>
        </template>
      </div>
      <div v-if="t.err" class="err">{{ t.err }}</div>
    </div>
  </Loader>
</template>
<script>
import Loader from '@/components/Loader.vue';
import { call, fileUrl } from '@/lib/api.js';
import { dmy } from '@/lib/format.js';
export default {
  components: { Loader },
  data() { return { loading: true, error: '', tickets: [], dmy }; },
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
