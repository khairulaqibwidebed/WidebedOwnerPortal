<template>
  <Loader :loading="loading" :error="error" @retry="load">
    <p class="sub">Your owner statements and payments. A month appears here once Widebed has paid it.</p>
    <div v-if="!payments.length" class="empty">No payments yet.</div>
    <template v-for="g in groups" :key="g.month">
      <h2>{{ monthName(g.month) }}</h2>
      <div v-for="p in g.items" :key="p.id" class="card">
        <div class="title">{{ p.unit }} <span class="chip green">Paid</span></div>
        <div class="sub" style="margin:2px 0 8px">{{ p.property }}<template v-if="p.arrangement"> · {{ p.arrangement }}</template></div>
        <div class="row"><span>Amount paid</span><span><b>{{ rm(p.amount) }}</b></span></div>
        <div class="row" v-if="p.paidDate"><span>Date paid</span><span>{{ dmy(p.paidDate) }}</span></div>
        <div class="row" v-if="p.ref"><span>Bank reference</span><span>{{ p.ref }}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button v-if="p.hasPdf" class="btn small" :disabled="busy[p.id]" @click="statement(p)">{{ busy[p.id] === 'pdf' ? 'Preparing…' : 'Owner statement (PDF)' }}</button>
          <button class="btn small ghost" :disabled="busy[p.id]" @click="slips(p)">{{ busy[p.id] === 'slip' ? 'Opening…' : 'Pay slip' }}</button>
        </div>
        <div v-if="p.files" style="margin-top:8px">
          <div v-if="!p.files.length" class="hint">No pay slip file found.</div>
          <a v-for="f in p.files" :key="f.id" class="lnk" :href="f.url" target="_blank" rel="noopener">{{ f.name }}</a>
        </div>
        <div v-if="p.err" class="err">{{ p.err }}</div>
      </div>
    </template>
  </Loader>
</template>
<script>
import Loader from '@/components/Loader.vue';
import { call, fileUrl } from '@/lib/api.js';
import { dmy, monthName, rm } from '@/lib/format.js';
import { buildStatementPdf, loadPdfKit } from '@/lib/statement-pdf.js';
export default {
  components: { Loader },
  data() { return { loading: true, error: '', payments: [], busy: {}, dmy, monthName, rm }; },
  computed: {
    groups() { const m = new Map(); for (const p of this.payments) { if (!m.has(p.month)) m.set(p.month, []); m.get(p.month).push(p); } return [...m].map(([month, items]) => ({ month, items })); }
  },
  mounted() { this.load(); },
  methods: {
    async load() { this.loading = true; this.error = ''; try { this.payments = (await call('payments')).payments; } catch (e) { this.error = e.message; } finally { this.loading = false; } },
    async statement(p) {
      p.err = ''; this.busy = { ...this.busy, [p.id]: 'pdf' };
      try {
        const { pdf } = await call('statement', { id: p.id });
        const X = await loadPdfKit();
        const bytes = await buildStatementPdf(X.lib, X.fontkit, X.fonts, pdf);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = `${p.unit} ${p.month} Owner Statement.pdf`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) { p.err = e.message; }
      finally { this.busy = { ...this.busy, [p.id]: '' }; }
    },
    async slips(p) {
      p.err = ''; this.busy = { ...this.busy, [p.id]: 'slip' };
      try {
        const { files } = await call('slips', { id: p.id });
        p.files = await Promise.all(files.map(async f => ({ ...f, url: await fileUrl('slip', p.id, f.id) })));
      } catch (e) { p.err = e.message; }
      finally { this.busy = { ...this.busy, [p.id]: '' }; }
    }
  }
};
</script>
