<template>
  <div>
    <template v-if="!unitId"><h1 class="page-h">Check-ins and check-outs</h1>
    <p class="page-sub">Dates only. Showing the last 14 months and the next 3 months.</p></template>
    <Loader :loading="loading" :error="error" @retry="load">
      <div class="seg" style="--n:2" :style="{ '--i': tab === 'up' ? 0 : 1 }"><button :class="{ on: tab === 'up' }" @click="tab = 'up'">Upcoming ({{ upcoming.length }})</button><button :class="{ on: tab === 'past' }" @click="tab = 'past'">Past ({{ past.length }})</button></div>
      <UnitFilterBar v-if="!unitId" :units="codes" v-model="pick" />
      <div v-if="!list.length" class="empty">Nothing to show here.</div>
      <div class="grid stagger" :key="tab">
        <div v-for="(s, i) in list" :key="i" class="card stripe" :class="{ green: now(s) }">
          <div class="card-h">
            <div class="title" v-if="!unitId">{{ s.unit }} <span class="sub" style="font-weight:400">· {{ s.property }}</span></div>
            <span v-if="now(s)" class="chip green">Staying now</span>
          </div>
          <div class="dates">
            <div class="d"><small>Check-in</small><b>{{ dmy(s.arrival) }}</b></div>
            <div class="n"><span class="pill">{{ s.nights.toLocaleString('en-US') }} {{ s.nights === 1 ? 'night' : 'nights' }}</span><small v-if="s.nights >= 60">{{ span(s.nights) }}</small></div>
            <div class="d"><small>Check-out</small><b>{{ dmy(s.departure) }}</b></div>
          </div>
        </div>
      </div>
    </Loader>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import UnitFilterBar from '@/components/UnitFilterBar.vue';
import { call } from '@/lib/api.js';
import { dmy } from '@/lib/format.js';
export default {
  props: { unitId: { type: String, default: '' } },
  components: { Loader, UnitFilterBar },
  data() { return { loading: true, error: '', stays: [], today: '', tab: 'up', pick: '', dmy }; },
  computed: {
    codes() { const q = this.tab === 'up' ? s => s.departure >= this.today : s => s.departure < this.today; return [...new Set(this.stays.filter(q).map(s => s.unit))].sort(); },
    shown() { return this.pick && this.codes.includes(this.pick) ? this.stays.filter(s => s.unit === this.pick) : this.stays; },
    upcoming() { return this.shown.filter(s => s.departure >= this.today).sort((a, b) => a.arrival.localeCompare(b.arrival)); },
    past() { return this.shown.filter(s => s.departure < this.today); },
    list() { return this.tab === 'up' ? this.upcoming : this.past; }
  },
  mounted() { this.load(); },
  methods: { span(n) { const y = Math.floor(n / 365), m = Math.round((n % 365) / 30.4); const t = []; if (y) t.push(y + (y === 1 ? ' yr' : ' yrs')); if (m) t.push(m + (m === 1 ? ' mo' : ' mos')); return '≈ ' + (t.join(' ') || '12 mos'); }, now(s) { return s.arrival <= this.today && s.departure >= this.today; }, async load() { this.loading = true; this.error = ''; try { const r = await call('stays', { unitId: this.unitId }); this.stays = r.stays; this.today = r.today; } catch (e) { this.error = e.message; } finally { this.loading = false; } } }
};
</script>
