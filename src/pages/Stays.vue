<template>
  <div class="swipearea">
    <template v-if="!unitId"><h1 class="page-h">Check-ins and check-outs</h1>
    <p class="page-sub">Dates, nights and the gross rental of each stay. Showing the last 14 months and the next 3 months.</p></template>
    <Loader :loading="loading" :error="error" @retry="load">
      <div class="reqbar"><button type="button" class="btn small" @click="asking = true">Request a booking</button><span class="hint">Book your own unit for a stay. Widebed confirms it.</span></div>
      <div class="seg" style="--n:2" :style="{ '--i': tab === 'up' ? 0 : 1 }"><button :class="{ on: tab === 'up' }" @click="tab = 'up'">Upcoming ({{ upcoming.length }})</button><button :class="{ on: tab === 'past' }" @click="tab = 'past'">Past ({{ past.length }})</button></div>
      <UnitFilterBar v-if="!unitId" :units="codes" v-model="pick" />
      <SwipeTabs :model-value="tab" :ids="['up', 'past']" :disabled="!!unitId" @update:model-value="tab = $event">
        <template v-for="id in ['up', 'past']" :key="id" #[id]>
          <div v-if="!listFor(id).length" class="empty">Nothing to show here.</div>
          <div class="grid stagger">
          <div v-for="(s, i) in listFor(id)" :key="s.id || i" class="card stripe" :class="{ green: now(s) || (s.req && s.status === 'confirmed'), amber: s.req && s.status === 'pending' }">
            <div class="card-h">
              <div class="title" v-if="!unitId">{{ s.unit }} <span class="sub" style="font-weight:400">· {{ s.property }}</span></div>
              <span v-if="s.req" class="chip" :class="{ green: s.status === 'confirmed', amber: s.status === 'pending' }">{{ { pending: 'Requested', confirmed: 'Booked', declined: 'Declined' }[s.status] }}</span>
              <span v-else-if="now(s)" class="chip green">Staying now</span>
            </div>
            <div class="sub reqtag" v-if="s.req">Owner booking{{ s.status === 'pending' ? ' · waiting for Widebed to confirm' : '' }}</div>
            <div class="dates">
              <div class="d"><small>Check-in</small><b>{{ dmy(s.arrival) }}</b></div>
              <div class="n"><span class="pill">{{ s.nights.toLocaleString('en-US') }} {{ s.nights === 1 ? 'night' : 'nights' }}</span><small v-if="s.nights >= 60">{{ span(s.nights) }}</small></div>
              <div class="d"><small>Check-out</small><b>{{ dmy(s.departure) }}</b></div>
            </div>
            <div class="sub reqnote" v-if="s.req && s.note">“{{ s.note }}”</div>
            <div class="err" v-if="s.req && s.status === 'declined'">Widebed could not book these dates{{ s.declineReason ? ': ' + s.declineReason : '.' }}</div>
            <div class="reqact" v-if="s.req && s.status === 'pending'"><button type="button" class="link-btn" :disabled="cancelling === s.id" @click="cancelReq(s)">{{ cancelling === s.id ? 'Cancelling…' : 'Cancel request' }}</button></div>
            <div class="row gross" v-if="s.grossRental != null"><span>{{ s.grossPer === 'month' ? 'Gross rental (per month)' : 'Gross rental' }}</span><span>{{ rm(s.grossRental) }}</span></div>
          </div>
          </div>
        </template>
      </SwipeTabs>
    </Loader>
    <Transition name="sheet"><BookingRequestModal v-if="asking" :units="units" :unit-id="unitId" :taken="busy" :today="today" @close="asking = false" @sent="load(true)" /></Transition>
  </div>
</template>
<script>
import Loader from '@/components/Loader.vue';
import UnitFilterBar from '@/components/UnitFilterBar.vue';
import { call } from '@/lib/api.js';
import SwipeTabs from '@/components/SwipeTabs.vue';
import BookingRequestModal from '@/components/BookingRequestModal.vue';
import { dmy, rm } from '@/lib/format.js';
export default {
  props: { unitId: { type: String, default: '' } },
  components: { SwipeTabs, BookingRequestModal, Loader, UnitFilterBar },
  data() { return { loading: true, error: '', stays: [], units: [], today: '', tab: 'up', pick: '', asking: false, cancelling: '', dmy, rm }; },
  computed: {
    // Nights already taken (stays, and requests that are waiting or confirmed) for the calendar
    busy() { return this.stays.filter(s => !s.req || ['pending', 'confirmed'].includes(s.status)).map(s => ({ unit: s.unit, arrival: s.arrival, departure: s.departure })); },
    codes() { const q = this.tab === 'up' ? s => s.departure >= this.today : s => s.departure < this.today; return [...new Set(this.stays.filter(q).map(s => s.unit))].sort(); },
    shown() { return this.pick && this.codes.includes(this.pick) ? this.stays.filter(s => s.unit === this.pick) : this.stays; },
    upcoming() { return this.shown.filter(s => s.departure >= this.today).sort((a, b) => a.arrival.localeCompare(b.arrival)); },
    past() { return this.shown.filter(s => s.departure < this.today); },
    list() { return this.tab === 'up' ? this.upcoming : this.past; }
  },
  mounted() { this.load(); },
  methods: { listFor(id) { return id === 'up' ? this.upcoming : this.past; }, span(n) { const y = Math.floor(n / 365), m = Math.round((n % 365) / 30.4); const t = []; if (y) t.push(y + (y === 1 ? ' yr' : ' yrs')); if (m) t.push(m + (m === 1 ? ' mo' : ' mos')); return '≈ ' + (t.join(' ') || '12 mos'); }, now(s) { return !s.req && s.arrival <= this.today && s.departure >= this.today; }, async load(quiet) {
      if (!quiet) this.loading = true; this.error = '';
      try {
        // Stays, this owner's booking requests and (whole page only) the unit list for the request form
        const [r, q, o] = await Promise.all([call('stays', { unitId: this.unitId }), call('bookingRequests', { unitId: this.unitId }), this.unitId ? null : call('overview')]);
        const asStay = x => ({ ...x, req: true, nights: x.nights || 0 });
        this.stays = [...r.stays, ...q.requests.filter(x => x.status !== 'declined' || x.arrival >= r.today).map(asStay)]; this.today = r.today;
        this.units = o ? o.units.map(u => ({ id: u.id, code: u.code, property: u.property })) : [];
      } catch (e) { this.error = e.message; } finally { this.loading = false; }
    },
    async cancelReq(s) {
      this.cancelling = s.id;
      try { await call('cancelBookingRequest', { id: s.id }); await this.load(true); } catch (e) { this.error = e.message; } finally { this.cancelling = ''; }
    } }
};
</script>
