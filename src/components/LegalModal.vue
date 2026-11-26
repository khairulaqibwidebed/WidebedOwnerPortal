<template>
  <div class="lm" role="dialog" aria-modal="true" @click.self="$emit('close')" @keydown.esc="$emit('close')" tabindex="-1" ref="box">
    <div class="lm-card">
      <div class="lm-top">
        <div class="lm-title">{{ ms ? 'Terma dan Notis Privasi' : 'Terms and Privacy Notice' }}</div>
        <LangSwitch :model-value="ms" @update:model-value="$emit('update:ms', $event)" />
        <button class="vw-btn lm-x" type="button" @click="$emit('close')" aria-label="Close">✕</button>
      </div>
      <TermsText :ms="ms" :start="start" class="lm-body" />
    </div>
  </div>
</template>
<script>
import TermsText from '@/components/TermsText.vue';
import LangSwitch from '@/components/LangSwitch.vue';
export default {
  components: { TermsText, LangSwitch },
  props: { ms: { type: Boolean, default: false }, start: { type: String, default: 'terms' } },
  emits: ['close', 'update:ms'],
  mounted() { this.$refs.box?.focus(); document.body.style.overflow = 'hidden'; },
  unmounted() { document.body.style.overflow = ''; }
};
</script>
