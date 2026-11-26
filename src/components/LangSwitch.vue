<template>
  <div class="lang" role="group" aria-label="Language">
    <button type="button" :class="{ on: !modelValue }" @click="$emit('update:modelValue', false)">English</button>
    <button type="button" :class="{ on: modelValue }" @click="$emit('update:modelValue', true)">Bahasa Malaysia</button>
  </div>
</template>
<script>
export default { props: { modelValue: { type: Boolean, default: false } }, emits: ['update:modelValue'] };
</script>
