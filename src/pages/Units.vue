<template>
  <Loader :loading="loading" :error="error" @retry="load">
    <p class="sub">Your properties and units. This page is for viewing only.</p>
    <div v-if="!units.length" class="empty">No units are linked to your account yet.</div>
    <div v-for="u in units" :key="u.id" class="card">
      <div class="title">{{ u.code }} <span class="chip brand" v-if="u.arrangement">{{ u.arrangement }}</span></div>
      <div class="sub" style="margin:2px 0 8px">{{ u.property }}</div>
      <div class="row" v-if="addr(u)"><span>Address</span><span>{{ addr(u) }}</span></div>
      <div class="row" v-if="u.details.type"><span>Type</span><span>{{ u.details.type }}</span></div>
      <div class="row" v-if="u.details.bedrooms != null"><span>Bedrooms</span><span>{{ u.details.bedrooms }}</span></div>
      <div class="row" v-if="u.details.bathrooms != null"><span>Bathrooms</span><span>{{ u.details.bathrooms }}</span></div>
      <div class="row" v-if="u.details.sizeSqft"><span>Size</span><span>{{ u.details.sizeSqft }} sq ft</span></div>
      <div class="row" v-if="u.details.carParks != null"><span>Car parks</span><span>{{ u.details.carParks }}</span></div>
      <div class="row" v-if="u.feePct != null"><span>Service fee</span><span>{{ pct(u.feePct) }}</span></div>
      <div class="row" v-if="u.owner_since"><span>Your ownership from</span><span>{{ dmy(u.owner_since) }}</span></div>
    </div>
  </Loader>
</template>
<script>
import Loader from '@/components/Loader.vue';
import { call } from '@/lib/api.js';
import { dmy, pct } from '@/lib/format.js';
export default {
  components: { Loader },
  data() { return { loading: true, error: '', units: [], dmy, pct }; },
  mounted() { this.load(); },
  methods: {
    addr: u => [u.propertyInfo.address, u.propertyInfo.city, u.propertyInfo.state].filter(Boolean).join(', '),
    async load() { this.loading = true; this.error = ''; try { this.units = (await call('overview')).units; } catch (e) { this.error = e.message; } finally { this.loading = false; } }
  }
};
</script>
