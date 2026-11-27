<template>
  <div class="rc" role="group" aria-label="Pick check-in and check-out dates">
    <div class="rc-head">
      <button type="button" class="rc-nav" :disabled="!canPrev" aria-label="Previous month" @click="shift(-1)">‹</button>
      <b>{{ title }}</b>
      <button type="button" class="rc-nav" aria-label="Next month" @click="shift(1)">›</button>
    </div>
    <div class="rc-grid rc-dow" aria-hidden="true"><span v-for="d in DOW" :key="d">{{ d }}</span></div>
    <div class="rc-grid">
      <template v-for="(c, i) in cells" :key="i">
        <span v-if="!c" class="rc-blank"></span>
        <button v-else type="button" class="rc-day" :class="cls(c)" :disabled="off(c)" :aria-pressed="c === arrival || c === departure" :aria-label="label(c)" @click="pick(c)">{{ +c.slice(8) }}</button>
      </template>
    </div>
    <div class="rc-key"><span><i class="k-sel"></i>Your stay</span><span><i class="k-busy"></i>Already booked</span></div>
  </div>
</template>
<script>
// Two taps: check-in, then check-out. Nights already booked on the unit are greyed and cannot be crossed.
// busy = [{ arrival, departure }] of this unit (a stay holds the nights from arrival up to, not including, departure).
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const addDay = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export default {
  props: { arrival: { type: String, default: '' }, departure: { type: String, default: '' }, busy: { type: Array, default: () => [] }, today: { type: String, required: true } },
  emits: ['update:arrival', 'update:departure'],
  data() { const [y, m] = this.today.split('-').map(Number); return { DOW, y, m: m - 1, y0: y, m0: m - 1 }; },
  computed: {
    title() { return `${MON[this.m]} ${this.y}`; },
    canPrev() { return this.y > this.y0 || this.m > this.m0; },
    cells() {
      const first = new Date(Date.UTC(this.y, this.m, 1)), n = new Date(Date.UTC(this.y, this.m + 1, 0)).getUTCDate(), lead = (first.getUTCDay() + 6) % 7;
      return [...Array(lead).fill(''), ...Array.from({ length: n }, (_, i) => iso(this.y, this.m, i + 1))];
    },
    picking() { return !!this.arrival && !this.departure; },
    taken() { const s = new Set(); for (const b of this.busy) for (let d = b.arrival; d < b.departure && s.size < 20000; d = addDay(d, 1)) s.add(d); return s; }
  },
  methods: {
    shift(n) { const t = this.m + n; this.y += Math.floor(t / 12); this.m = ((t % 12) + 12) % 12; },
    // a night is taken when a stay holds it; the check-out day itself is free for a new check-in
    off(c) { return c < this.today || (this.picking && c > this.arrival ? !this.reach(c) : this.taken.has(c)); },
    reach(c) { for (let d = this.arrival; d < c; d = addDay(d, 1)) if (this.taken.has(d)) return false; return true; },
    cls(c) { return { sel: c === this.arrival || c === this.departure, mid: this.arrival && this.departure && c > this.arrival && c < this.departure, busy: this.taken.has(c), today: c === this.today, out: this.picking && c < this.arrival }; },
    label(c) { return `${+c.slice(8)} ${MON[+c.slice(5, 7) - 1]} ${c.slice(0, 4)}${this.taken.has(c) ? ', already booked' : ''}`; },
    pick(c) {
      if (!this.picking || c <= this.arrival) { this.$emit('update:arrival', c); this.$emit('update:departure', ''); return; }
      this.$emit('update:departure', c);
    }
  }
};
</script>
