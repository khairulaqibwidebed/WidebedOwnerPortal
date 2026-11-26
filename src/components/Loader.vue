<template>
  <div v-if="loading" class="skeleton">Loading…</div>
  <div v-else-if="error" class="err">{{ error }} <button class="link-btn" @click="$emit('retry')">Try again</button></div>
  <slot v-else />
</template>
<script>
export default { props: { loading: Boolean, error: { type: String, default: '' } }, emits: ['retry'] };
</script>
