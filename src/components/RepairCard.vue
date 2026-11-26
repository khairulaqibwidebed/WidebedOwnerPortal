<template>
  <router-link :to="{ path: `/maintenance/${t.id}`, query: fromUnit ? { from: t.unitId || fromUnit } : {} }" class="card stripe rcard clickable" :class="cls">
    <div class="rtop">
      <div class="title">{{ t.title }}</div>
      <span class="chip" :class="cls">{{ t.status }}</span>
      <span class="chev" aria-hidden="true">›</span>
    </div>
    <div class="sub" style="margin:2px 0 0"><template v-if="!fromUnit">{{ t.unit }} · {{ t.property }}<template v-if="t.date"> · </template></template><template v-if="t.date">{{ dmy(t.date) }}</template></div>
    <div class="rprog">
      <div class="segs"><i v-for="n in STAGES.length" :key="n" :class="{ on: n <= step }"></i></div>
      <span class="sub" style="margin:0">{{ t.status === 'Cancelled' ? 'Cancelled' : `Step ${step} of ${STAGES.length} · ${STAGES[step - 1]}` }}</span>
    </div>
  </router-link>
</template>
<script>
import { dmy, STAGES, stepOf } from '@/lib/format.js';
export default {
  props: { t: { type: Object, required: true }, fromUnit: { type: String, default: '' } },
  data() { return { dmy, STAGES }; },
  computed: {
    step() { return stepOf(this.t.status) + 1; },
    cls() { return this.t.status === 'Completed' ? 'green' : this.t.status === 'In progress' ? 'amber' : ''; }
  }
};
</script>
