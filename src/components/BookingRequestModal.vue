<template>
  <div class="cd" role="dialog" aria-modal="true" aria-labelledby="brq-t" @click.self="!busy && $emit('close')" @keydown.esc="!busy && $emit('close')">
    <form class="cd-card brq" @submit.prevent="send" novalidate>
      <div id="brq-t" class="cd-title">Request a booking</div>
      <p class="cd-text">Ask Widebed to block your own unit for your stay. Our team will confirm it.</p>
      <template v-if="!done">
        <template v-if="!unitId">
          <label for="brq-u">Unit</label>
          <select id="brq-u" v-model="unit"><option value="" disabled>Choose a unit</option><option v-for="u in units" :key="u.id" :value="u.id">{{ u.code }}{{ u.property ? ' · ' + u.property : '' }}</option></select>
        </template>
        <RangeCalendar v-model:arrival="arrival" v-model:departure="departure" :busy="busyFor" :today="today" />
        <div class="brq-dates">
          <div><small>Check-in</small><b>{{ arrival ? dmy(arrival) : 'Tap a day' }}</b></div>
          <div><small>Check-out</small><b>{{ departure ? dmy(departure) : arrival ? 'Tap a day' : '—' }}</b></div>
        </div>
        <div class="brq-n" v-if="nights > 0">{{ nights }} {{ nights === 1 ? 'night' : 'nights' }}</div>
        <label for="brq-note">Note for Widebed (optional)</label>
        <textarea id="brq-note" v-model="note" rows="2" maxlength="300" placeholder="For example: family visit, 4 guests"></textarea>
        <div v-if="error" class="err pop">{{ error }}</div>
        <div class="cd-act">
          <button type="button" class="btn secondary" :disabled="busy" @click="$emit('close')">Cancel</button>
          <button class="btn" :class="{ 'is-busy': busy }" :disabled="busy || !ready">{{ busy ? 'Sending…' : 'Send request' }}</button>
        </div>
      </template>
      <template v-else>
        <div class="ok pop">Request sent. It shows as Requested on Check-ins until Widebed confirms it.</div>
        <div class="cd-act"><button type="button" class="btn" @click="$emit('close')">Done</button></div>
      </template>
    </form>
  </div>
</template>
<script>
import { call } from '@/lib/api.js';
import { dmy } from '@/lib/format.js';
import RangeCalendar from '@/components/RangeCalendar.vue';
const ymd = d => d.toISOString().slice(0, 10);
const addDay = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5));
export default {
  props: { taken: { type: Array, default: () => [] }, units: { type: Array, default: () => [] }, unitId: { type: String, default: '' }, today: { type: String, required: true } },
  components: { RangeCalendar },
  emits: ['close', 'sent'],
  data() { return { dmy, unit: this.unitId || (this.units.length === 1 ? this.units[0].id : ''), arrival: '', departure: '', note: '', busy: false, error: '', done: false }; },
  computed: {
    busyFor() { const u = this.units.find(x => x.id === this.unit)?.code; return this.taken.filter(b => !u || !b.unit || b.unit === u || this.unitId); },
    nights() { return this.arrival && this.departure ? Math.round((Date.parse(this.departure) - Date.parse(this.arrival)) / 864e5) : 0; },
    ready() { return !!(this.unit && this.arrival && this.departure && this.nights > 0 && this.arrival >= this.today); }
  },
  watch: { unit() { this.arrival = ''; this.departure = ''; } },
  mounted() { document.body.style.overflow = 'hidden'; },
  unmounted() { document.body.style.overflow = ''; },
  methods: {
    async send() {
      if (!this.ready || this.busy) return;
      this.busy = true; this.error = '';
      try { await call('requestBooking', { unitId: this.unit, arrival: this.arrival, departure: this.departure, note: this.note }); this.done = true; this.$emit('sent'); }
      catch (e) { this.error = e.message; } finally { this.busy = false; }
    }
  }
};
</script>
