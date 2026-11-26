<template>
  <div class="repair">
    <router-link :to="back.to" class="back">‹ {{ back.label }}</router-link>
    <Loader :loading="loading" :error="error" :count="1" :rows="4" @retry="load">
      <div class="pane" v-if="t">
        <div class="card">
          <div class="rtop"><div class="title" style="font-size:17px">{{ t.title }}</div><span class="chip" :class="cls">{{ t.status }}</span></div>
          <div class="sub" style="margin:4px 0 0">{{ t.unit }} · {{ t.property }}</div>
          <div class="sub" style="margin:2px 0 0" v-if="t.date">Reported {{ dmy(t.date) }}</div>
        </div>
        <h2>Job stages</h2>
        <div class="card">
          <div class="tl" :class="{ fin: t.status === 'Completed' }">
            <div v-for="(s, i) in STAGES" :key="s" class="tl-i" :class="{ done: i < cur, now: i === cur && t.status !== 'Cancelled', off: t.status === 'Cancelled' }">
              <span class="dot"></span>
              <div><b>{{ s }}</b><small v-if="i === 0 && t.date">{{ dmy(t.date) }}</small><small v-else-if="i === cur && t.status === 'Completed'">Job finished</small><small v-else-if="i === cur && t.status !== 'Cancelled'">Current stage</small></div>
            </div>
          </div>
          <div class="hint" v-if="t.status === 'Cancelled'">This job was cancelled.</div>
        </div>
        <template v-if="t.hasFiles">
          <h2>Photos and videos</h2>
          <div v-if="filesBusy" class="sk" style="height:120px;border-radius:12px"></div>
          <div v-else-if="filesErr" class="err">{{ filesErr }}</div>
          <div v-else-if="!files.length" class="empty" style="padding:14px">No photos or videos uploaded yet.</div>
          <div v-else class="card"><div class="media two stagger" style="margin-top:0">
            <button v-for="(f, n) in files" :key="f.id" class="thumb" type="button" :aria-label="f.name" @click="view = { items: files, start: n }">
              <video v-if="f.mimeType.startsWith('video/')" :src="f.url + '#t=0.1'" preload="metadata" muted playsinline></video>
              <img v-else :src="f.url" :alt="f.name" loading="lazy" />
              <span v-if="f.mimeType.startsWith('video/')" class="play">▶</span>
              <span v-if="f.at" class="stamp">{{ dateTime(f.at) }}</span>
            </button>
          </div></div>
        </template>
        <template v-else><h2>Photos and videos</h2><div class="empty" style="padding:14px">No photos or videos uploaded yet.</div></template>
      </div>
    </Loader>
    <Viewer v-if="view" :items="view.items" :start="view.start" @close="view = null" />
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import Viewer from '@/components/Viewer.vue';
import { call, fileUrl } from '@/lib/api.js';
import { dmy, dateTime, STAGES, stepOf } from '@/lib/format.js';
export default {
  components: { Loader, Viewer },
  data() { return { loading: true, error: '', t: null, files: [], filesBusy: false, filesErr: '', view: null, dmy, dateTime, STAGES }; },
  computed: {
    cur() { return stepOf(this.t?.status); },
    cls() { return this.t?.status === 'Completed' ? 'green' : this.t?.status === 'In progress' ? 'amber' : ''; },
    back() { const f = this.$route.query.from; return f ? { to: `/units/${f}?tab=maintenance`, label: 'Unit' } : { to: '/maintenance', label: 'Maintenance' }; }
  },
  mounted() { this.load(); },
  methods: {
    async load() {
      this.loading = true; this.error = '';
      try { this.t = (await call('ticket', { id: this.$route.params.id })).ticket; this.loadFiles(); }
      catch (e) { this.error = e.message; } finally { this.loading = false; }
    },
    async loadFiles() {
      if (!this.t.hasFiles) return;
      this.filesBusy = true; this.filesErr = '';
      try {
        const { files } = await call('ticketFiles', { id: this.t.id });
        this.files = await Promise.all(files.map(async f => ({ ...f, url: await fileUrl('ticket', this.t.id, f.id) })));
      } catch (e) { this.filesErr = e.message; } finally { this.filesBusy = false; }
    }
  }
};
</script>
