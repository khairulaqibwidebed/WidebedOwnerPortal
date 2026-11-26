<template>
  <div>
    <h1 class="page-h">Check-ins and check-outs</h1>
    <p class="page-sub">Dates only. Showing the last 14 months and the next 3 months.</p>
    <Loader :loading="loading" :error="error" @retry="load">
      <div class="seg"><button :class="{ on: tab === 'up' }" @click="tab = 'up'">Upcoming ({{ upcoming.length }})</button><button :class="{ on: tab === 'past' }" @click="tab = 'past'">Past ({{ past.length }})</button></div>
      <div v-if="!list.length" class="empty">Nothing to show here.</div>
      <div class="grid">
        <div v-for="(s, i) in list" :key="i" class="card stripe" :class="{ green: now(s) }">
          <div class="card-h">
            <div class="title">{{ s.unit }} <span class="sub" style="font-weight:400">· {{ s.property }}</span></div>
            <span v-if="now(s)" class="chip green">Staying now</span>
          </div>
          <div class="dates">
            <div class="d"><small>Check-in</small><b>{{ dmy(s.arrival) }}</b></div>
            <div class="n">{{ s.nights }} {{ s.nights === 1 ? 'night' : 'nights' }}</div>
            <div class="d"><small>Check-out</small><b>{{ dmy(s.departure) }}</b></div>
          </div>
        </div>
      </div>
    </Loader>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import { call } from '@/lib/api.js';
import { dmy } from '@/lib/format.js';
export default {
  components: { Loader },
  data() { return { loading: true, error: '', stays: [], today: '', tab: 'up', dmy }; },
  computed: {
    upcoming() { return this.stays.filter(s => s.departure >= this.today).sort((a, b) => a.arrival.localeCompare(b.arrival)); },
    past() { return this.stays.filter(s => s.departure < this.today); },
    list() { return this.tab === 'up' ? this.upcoming : this.past; }
  },
  mounted() { this.load(); },
  methods: { now(s) { return s.arrival <= this.today && s.departure >= this.today; }, async load() { this.loading = true; this.error = ''; try { const r = await call('stays'); this.stays = r.stays; this.today = r.today; } catch (e) { this.error = e.message; } finally { this.loading = false; } } }
};
</script>
