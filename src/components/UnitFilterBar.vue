<template>
  <div v-if="units.length > 1" class="ufb">
    <div v-if="units.length <= max" class="chips" ref="row">
      <button v-for="c in ['', ...units]" :key="c" type="button" :class="{ on: modelValue === c }" :data-c="c" @click="$emit('update:modelValue', c)">{{ c || 'All units' }}</button>
    </div>
    <div v-else class="pick" :class="{ filtered: !!modelValue }">
      <select :value="modelValue" aria-label="Filter by unit" @change="$emit('update:modelValue', $event.target.value)">
        <option value="">All units</option><option v-for="c in units" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>
  </div>
</template>
<script>
// One filter for every list: a row of pills for up to 5 units, a single dropdown for more.
export default {
  props: { units: { type: Array, default: () => [] }, modelValue: { type: String, default: '' }, max: { type: Number, default: 5 } },
  emits: ['update:modelValue'],
  watch: { modelValue() { this.$nextTick(() => { const b = this.$refs.row?.querySelector('button.on'); b?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }); } }
};
</script>
