<template>
  <div>
    <div class="hero">
      <h1>{{ greeting }}</h1>
      <p>Tap a unit to see its check-ins, payments and maintenance.</p>
      <div class="hero-stats" v-if="!loading && units.length">
        <div class="hero-stat"><b>{{ units.length }}</b><span>{{ units.length === 1 ? 'Unit' : 'Units' }}</span></div>
        <div class="hero-stat"><b>{{ properties }}</b><span>{{ properties === 1 ? 'Property' : 'Properties' }}</span></div>
      </div>
    </div>
    <Loader :loading="loading" :error="error" :count="2" :rows="3" @retry="load">
      <div v-if="!units.length" class="empty">No units are linked to your account yet.</div>
      <div class="grid stagger">
        <router-link v-for="u in units" :key="u.id" :to="`/units/${u.id}`" class="card ucard clickable">
          <div class="ucard-top">
            <div class="u-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/></svg></div>
            <div class="grow"><div class="unit-code">{{ u.code }}</div><div class="sub" style="margin:0">{{ u.property }}</div></div>
            <span class="chip" :class="u.occupied ? 'green' : ''" v-if="u.occupied != null">{{ u.occupied ? 'Occupied' : 'Vacant' }}</span>
            <span class="chev" aria-hidden="true">›</span>
          </div>
          <div class="ucard-body">
            <div class="addr" style="margin-top:0" v-if="addr(u)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
              <span class="clamp2">{{ addr(u) }}</span>
            </div>
            <div class="tiles" v-if="tiles(u).length"><div class="tile" v-for="t in tiles(u)" :key="t.label"><b>{{ t.value }}</b><span>{{ t.label }}</span></div></div>
            <div class="kv" v-if="u.feePct != null || u.owner_since">
              <div class="row" v-if="u.feePct != null"><span>Service fee</span><span>{{ pct(u.feePct) }}</span></div>
              <div class="row" v-if="u.owner_since"><span>Your ownership from</span><span>{{ dmy(u.owner_since) }}</span></div>
            </div>
          </div>
        </router-link>
      </div>
    </Loader>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import { call } from '@/lib/api.js';
import { dmy, pct, cleanAddress } from '@/lib/format.js';
export default {
  components: { Loader },
  data() { return { loading: true, error: '', units: [], profile: null, dmy, pct }; },
  computed: {
    greeting() { const n = (this.profile?.name || '').split(/\s+/)[0]; return n ? `Welcome, ${n}` : 'Welcome'; },
    properties() { return new Set(this.units.map(u => u.property)).size; }
  },
  mounted() { this.load(); },
  methods: {
    addr: u => cleanAddress([u.propertyInfo.address, u.propertyInfo.city, u.propertyInfo.state]),
    tiles(u) {
      const d = u.details, out = [];
      if (d.type) out.push({ value: d.type, label: '' });
      if (d.bedrooms != null) out.push({ value: d.bedrooms, label: 'Bedrooms' });
      if (d.bathrooms != null) out.push({ value: d.bathrooms, label: 'Bathrooms' });
      if (d.sizeSqft) out.push({ value: d.sizeSqft, label: 'Sq ft' });
      if (d.carParks != null) out.push({ value: d.carParks, label: 'Car parks' });
      return out;
    },
    async load() { this.loading = true; this.error = ''; try { const r = await call('overview'); this.units = r.units; this.profile = r.profile; } catch (e) { this.error = e.message; } finally { this.loading = false; } }
  }
};
</script>
