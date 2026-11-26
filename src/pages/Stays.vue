<template>
  <Loader :loading="loading" :error="error" @retry="load">
    <div class="seg"><button :class="{ on: tab === 'up' }" @click="tab = 'up'">Upcoming ({{ upcoming.length }})</button><button :class="{ on: tab === 'past' }" @click="tab = 'past'">Past ({{ past.length }})</button></div>
    <p class="sub">Dates only. Showing the last 14 months and the next 3 months.</p>
    <div v-if="!list.length" class="empty">Nothing to show here.</div>
    <div v-for="(s, i) in list" :key="i" class="card">
      <div class="title">{{ s.unit }} <span class="sub" style="font-weight:400">· {{ s.property }}</span></div>
      <div class="row"><span>Check-in</span><span>{{ dmy(s.arrival) }}</span></div>
      <div class="row"><span>Check-out</span><span>{{ dmy(s.departure) }}</span></div>
      <div class="row"><span>Nights</span><span>{{ s.nights }}</span></div>
      <span v-if="s.arrival <= today && s.departure >= today" class="chip green">Staying now</span>
    </div>
  </Loader>
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
  methods: { async load() { this.loading = true; this.error = ''; try { const r = await call('stays'); this.stays = r.stays; this.today = r.today; } catch (e) { this.error = e.message; } finally { this.loading = false; } } }
};
</script>
