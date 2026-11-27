<template>
  <div class="cd" role="alertdialog" aria-modal="true" :aria-labelledby="'cd-t'" @click.self="!busy && $emit('cancel')" @keydown.esc="!busy && $emit('cancel')">
    <div class="cd-card">
      <div id="cd-t" class="cd-title">{{ title }}</div>
      <p class="cd-text" v-if="text">{{ text }}</p>
      <div class="cd-act">
        <button type="button" class="btn secondary" ref="cancel" :disabled="busy" @click="$emit('cancel')">{{ cancelLabel }}</button>
        <button type="button" class="btn" :class="{ 'is-busy': busy }" :disabled="busy" @click="$emit('confirm')">{{ busy ? busyLabel : okLabel }}</button>
      </div>
    </div>
  </div>
</template>
<script>
// Small "are you sure?" popup. Cancel has focus first so Enter never confirms by accident.
export default {
  props: { title: String, text: String, okLabel: { type: String, default: 'Confirm' }, cancelLabel: { type: String, default: 'Cancel' }, busyLabel: { type: String, default: 'Please wait…' }, busy: Boolean },
  emits: ['confirm', 'cancel'],
  mounted() { this.$refs.cancel?.focus(); document.body.style.overflow = 'hidden'; },
  unmounted() { document.body.style.overflow = ''; }
};
</script>
