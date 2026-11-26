<template>
  <div class="pw">
    <input :id="id" :value="modelValue" :type="show ? 'text' : 'password'" :autocomplete="autocomplete" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)" />
    <button type="button" class="eye" :aria-label="show ? 'Hide password' : 'Show password'" :aria-pressed="show" @click="show = !show">
      <svg v-if="!show" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
    </button>
  </div>
</template>
<script>
export default { props: { modelValue: { type: String, default: '' }, id: { type: String, default: '' }, autocomplete: { type: String, default: 'off' }, placeholder: { type: String, default: '' } }, emits: ['update:modelValue'], data() { return { show: false }; } };
</script>
