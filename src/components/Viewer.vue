<template>
  <div v-if="items.length" class="vw" role="dialog" aria-modal="true" @click.self="$emit('close')" @keydown.esc="$emit('close')" tabindex="-1" ref="box">
    <div class="vw-top">
      <div class="vw-name">{{ cur.name }}<span v-if="items.length > 1"> · {{ i + 1 }} of {{ items.length }}</span></div>
      <a class="vw-btn" :href="cur.url" :download="cur.name" target="_blank" rel="noopener">Download</a>
      <button class="vw-btn" @click="$emit('close')">Close</button>
    </div>
    <div class="vw-body" @click.self="$emit('close')">
      <button v-if="items.length > 1" class="vw-nav l" aria-label="Previous" @click="i = (i + items.length - 1) % items.length">‹</button>
      <video v-if="kind === 'video'" :key="cur.url" :src="cur.url" controls autoplay playsinline></video>
      <iframe v-else-if="kind === 'pdf'" :key="cur.url" :src="cur.url" title="Document"></iframe>
      <img v-else :key="cur.url" :src="cur.url" :alt="cur.name" />
      <button v-if="items.length > 1" class="vw-nav r" aria-label="Next" @click="i = (i + 1) % items.length">›</button>
    </div>
  </div>
</template>

<script>
// Opens photos, videos and PDFs on top of the same page (no new tab). items: [{ name, mimeType, url }]
export default {
  props: { items: { type: Array, default: () => [] }, start: { type: Number, default: 0 } },
  emits: ['close'],
  data() { return { i: this.start }; },
  computed: {
    cur() { return this.items[this.i] || this.items[0]; },
    kind() { const t = this.cur?.mimeType || ''; return t.startsWith('video/') ? 'video' : t === 'application/pdf' ? 'pdf' : 'image'; }
  },
  watch: { start(v) { this.i = v; } },
  mounted() { this.$refs.box?.focus(); document.body.style.overflow = 'hidden'; },
  unmounted() { document.body.style.overflow = ''; }
};
</script>
