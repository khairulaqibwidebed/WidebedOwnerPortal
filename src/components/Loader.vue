<template>
  <div v-if="loading" aria-busy="true" aria-label="Loading">
    <div v-for="n in count" :key="n" class="card sk-card">
      <div class="sk sk-title"></div>
      <div class="sk sk-sub"></div>
      <div class="sk-row" v-for="r in rows" :key="r"><div class="sk sk-l"></div><div class="sk sk-r"></div></div>
    </div>
  </div>
  <div v-else-if="error" class="err pop">{{ error }} <button class="link-btn" @click="$emit('retry')">Try again</button></div>
  <div v-else class="loaded"><slot /></div>
</template>
<script>
// Skeleton placeholders while a page loads: `count` cards of `rows` lines each.
export default { props: { loading: Boolean, error: { type: String, default: '' }, count: { type: Number, default: 3 }, rows: { type: Number, default: 3 } }, emits: ['retry'] };
</script>
