<template>
  <div>
  <Loader :loading="loading" :error="error" @retry="load">
    <template v-if="!unitId"><h1 class="page-h">Payments</h1>
    <p class="page-sub">Your owner statements and payments. A month appears here once Widebed has paid it.</p></template>
    <div v-if="!payments.length" class="empty">No payments yet.</div>
    <UnitFilterBar v-if="!unitId" :units="codes" v-model="pick" />
    <template v-for="g in groups" :key="g.month">
      <div class="month-h">{{ monthName(g.month) }}<small>{{ g.items.length }} {{ g.items.length === 1 ? 'payment' : 'payments' }}</small><span class="month-total">Total <b>{{ rm(g.total) }}</b></span></div>
      <div class="grid stagger paygrid"><div v-for="p in g.items" :key="p.id" class="card stripe green">
        <div class="rtop"><div class="title">{{ p.unit }}</div><span class="chip green">Paid</span></div>
        <div class="sub" style="margin:2px 0 8px">{{ p.property }}<template v-if="p.arrangement"> · {{ p.arrangement }}</template></div>
        <div class="amount">{{ rm(p.amount) }}</div>
        <div class="paymeta">
          <div class="row" v-if="p.paidDate"><span>Date paid</span><span>{{ dmy(p.paidDate) }}</span></div>
          <div class="row" v-if="p.ref"><span>Bank reference</span><span>{{ p.ref }}</span></div>
        </div>
        <div class="payact">
          <button v-if="p.hasPdf" class="btn small" :class="{ 'is-busy': busy[p.id] === 'pdf' }" :disabled="busy[p.id]" @click="statement(p)">{{ busy[p.id] === 'pdf' ? 'Preparing…' : 'Owner statement (PDF)' }}</button>
          <button class="btn small secondary" :class="{ 'is-busy': busy[p.id] === 'slip' }" :disabled="busy[p.id]" @click="slips(p)">{{ busy[p.id] === 'slip' ? 'Opening…' : 'Pay slip' }}</button>
        </div>
        <div v-if="p.files" class="attach">
          <div v-if="!p.files.length" class="hint" style="margin:0">No pay slip file found.</div>
          <button v-for="(f, n) in p.files" :key="f.id" class="achip" type="button" :title="f.name" @click="view = { items: p.files, start: n }">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg><span>{{ f.name }}</span>
          </button>
        </div>
        <div v-if="p.err" class="err pop">{{ p.err }}</div>
      </div></div>
    </template>
  </Loader>
  <Transition name="sheet"><Viewer v-if="view" :items="view.items" :start="view.start" @close="view = null" /></Transition>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import UnitFilterBar from '@/components/UnitFilterBar.vue';
import Viewer from '@/components/Viewer.vue';
import { call, fileUrl } from '@/lib/api.js';
import { dmy, monthName, rm } from '@/lib/format.js';
import { buildStatementPdf, loadPdfKit } from '@/lib/statement-pdf.js';
export default {
  props: { unitId: { type: String, default: '' } },
  components: { Loader, Viewer, UnitFilterBar },
  data() { return { loading: true, error: '', payments: [], pick: '', view: null, busy: {}, dmy, monthName, rm }; },
  computed: {
    codes() { return [...new Set(this.payments.map(p => p.unit))].sort(); },
    shown() { return this.pick && this.codes.includes(this.pick) ? this.payments.filter(p => p.unit === this.pick) : this.payments; },
    groups() { const m = new Map(); for (const p of this.shown) { if (!m.has(p.month)) m.set(p.month, []); m.get(p.month).push(p); } return [...m].map(([month, items]) => ({ month, items, total: items.reduce((s, p) => s + (+p.amount || 0), 0) })); }
  },
  mounted() { this.load(); },
  methods: {
    async load() { this.loading = true; this.error = ''; try { this.payments = (await call('payments', { unitId: this.unitId })).payments; } catch (e) { this.error = e.message; } finally { this.loading = false; } },
    async statement(p) {
      p.err = ''; this.busy = { ...this.busy, [p.id]: 'pdf' };
      try {
        const { pdf } = await call('statement', { id: p.id });
        const X = await loadPdfKit();
        const bytes = await buildStatementPdf(X.lib, X.fontkit, X.fonts, pdf);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        this.view = { items: [{ name: `${p.unit} ${p.month} Owner Statement.pdf`, mimeType: 'application/pdf', url }], start: 0 };
      } catch (e) { p.err = e.message; }
      finally { this.busy = { ...this.busy, [p.id]: '' }; }
    },
    async slips(p) {
      p.err = ''; this.busy = { ...this.busy, [p.id]: 'slip' };
      try {
        const { files } = await call('slips', { id: p.id });
        p.files = await Promise.all(files.map(async f => ({ ...f, url: await fileUrl('slip', p.id, f.id) })));
        if (p.files.length === 1) this.view = { items: p.files, start: 0 };   // one slip: open it straight away
      } catch (e) { p.err = e.message; }
      finally { this.busy = { ...this.busy, [p.id]: '' }; }
    }
  }
};
</script>
