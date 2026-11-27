<template>
  <div>
    <router-link to="/units" class="back">‹ All units</router-link>
    <Loader :loading="loading" :error="error" :count="1" :rows="4" @retry="load">
      <template v-if="unit">
        <div class="card ucard">
          <div class="ucard-top">
            <div class="u-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/></svg></div>
            <div class="grow"><div class="unit-code">{{ unit.code }}</div><div class="sub" style="margin:0">{{ unit.property }}</div></div>
            <span class="chip" :class="unit.occupied ? 'green' : ''" v-if="unit.occupied != null">{{ unit.occupied ? 'Occupied' : 'Vacant' }}</span>
          </div>
        </div>
        <div class="seg tabs4" style="--n:4" :style="{ '--i': tabs.findIndex(t => t.id === tab) }">
          <button v-for="t in tabs" :key="t.id" :class="{ on: tab === t.id }" @click="go(t.id)">{{ t.label }}</button>
        </div>
        <SwipeTabs :model-value="tab" :ids="tabs.map(t => t.id)" @update:model-value="go">
          <template #details>
            <div class="card">
          <div class="addr" style="margin-top:0" v-if="addr"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><span>{{ addr }}</span></div>
          <div class="tiles" v-if="tiles.length"><div class="tile" v-for="t in tiles" :key="t.label"><b>{{ t.value }}</b><span>{{ t.label }}</span></div></div>
          <div class="kv">
            <div class="row"><span>Unit</span><span>{{ unit.code }}</span></div>
            <div class="row"><span>Property</span><span>{{ unit.property }}</span></div>
            <div class="row" v-if="unit.arrangement"><span>Arrangement</span><span>{{ unit.arrangement }}</span></div>
            <div class="row" v-if="unit.feePct != null"><span>Service fee</span><span>{{ pct(unit.feePct) }}</span></div>
            <div class="row" v-if="unit.owner_since"><span>Your ownership from</span><span>{{ dmy(unit.owner_since) }}</span></div>
          </div>
        </div>
          </template>
          <template #stays><Stays :unit-id="unit.id" /></template>
          <template #payments><Payments :unit-id="unit.id" /></template>
          <template #maintenance><Maintenance :unit-id="unit.id" /></template>
        </SwipeTabs>
      </template>
    </Loader>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import Stays from '@/pages/Stays.vue';
import Payments from '@/pages/Payments.vue';
import Maintenance from '@/pages/Maintenance.vue';
import { call } from '@/lib/api.js';
import SwipeTabs from '@/components/SwipeTabs.vue';
import { dmy, pct, cleanAddress } from '@/lib/format.js';
export default {
  components: { SwipeTabs, Loader, Stays, Payments, Maintenance },
  data() { return { loading: true, error: '', unit: null, dmy, pct,
    tabs: [{ id: 'details', label: 'Details' }, { id: 'stays', label: 'Check-ins' }, { id: 'payments', label: 'Payments' }, { id: 'maintenance', label: 'Repairs' }] }; },
  computed: {
    tab() { return this.tabs.some(t => t.id === this.$route.query.tab) ? this.$route.query.tab : 'details'; },
    addr() { const u = this.unit; return u ? cleanAddress([u.propertyInfo.address, u.propertyInfo.city, u.propertyInfo.state]) : ''; },
    tiles() {
      const d = this.unit?.details || {}, out = [];
      if (d.type) out.push({ value: d.type, label: '' });
      if (d.bedrooms != null) out.push({ value: d.bedrooms, label: 'Bedrooms' });
      if (d.bathrooms != null) out.push({ value: d.bathrooms, label: 'Bathrooms' });
      if (d.sizeSqft) out.push({ value: d.sizeSqft, label: 'Sq ft' });
      if (d.carParks != null) out.push({ value: d.carParks, label: 'Car parks' });
      return out;
    }
  },
  mounted() { this.load(); },
  methods: {
    go(id) { this.$router.replace({ query: id === 'details' ? {} : { tab: id } }); },
    async load() {
      this.loading = true; this.error = '';
      try { this.unit = (await call('overview')).units.find(u => u.id === this.$route.params.id) || null; if (!this.unit) this.error = 'This unit was not found.'; }
      catch (e) { this.error = e.message; } finally { this.loading = false; }
    }
  }
};
</script>
