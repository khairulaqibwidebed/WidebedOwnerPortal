<template>
  <div>
  <Loader :loading="loading" :error="error" @retry="load">
    <template v-if="!unitId"><h1 class="page-h">Maintenance</h1>
    <p class="page-sub">Maintenance for your units and how far along each job is.</p></template>
    <div v-if="!shown.length" class="empty">No maintenance jobs to show.</div>
    <UnitFilterBar v-if="!unitId" :units="codes" v-model="pick" />
    <div class="grid stagger" :key="pick"><RepairCard v-for="t in shown" :key="t.id" :t="t" :from-unit="unitId" /></div>
  </Loader>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import RepairCard from '@/components/RepairCard.vue';
import UnitFilterBar from '@/components/UnitFilterBar.vue';
import { call } from '@/lib/api.js';
export default {
  props: { unitId: { type: String, default: '' } },
  components: { Loader, RepairCard, UnitFilterBar },
  data() { return { loading: true, error: '', tickets: [], pick: '' }; },
  computed: { codes() { return [...new Set(this.tickets.map(t => t.unit))].sort(); }, shown() { return this.pick && this.codes.includes(this.pick) ? this.tickets.filter(t => t.unit === this.pick) : this.tickets; } },
  mounted() { this.load(); },
  methods: { async load() { this.loading = true; this.error = ''; try { this.tickets = (await call('tickets', { unitId: this.unitId })).tickets; } catch (e) { this.error = e.message; } finally { this.loading = false; } } }
};
</script>
