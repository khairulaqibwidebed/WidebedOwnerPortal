<template>
  <div class="terms">
    <div class="terms-top"><a href="#" class="back" @click.prevent="$router.back()">‹ Back</a><LangSwitch v-model="ms" /></div>
    <h1>{{ ms ? 'Terma Penggunaan dan Notis Privasi' : 'Terms of Use and Privacy Notice' }}</h1>
    <p class="sub">{{ ms ? 'Portal Pemilik Widebed. Dikemas kini 26 November 2026.' : 'Widebed Owner Portal. Last updated 26 November 2026.' }}</p>
    <TermsText :ms="ms" />
  </div>
</template>
<script>
import TermsText from '@/components/TermsText.vue';
import LangSwitch from '@/components/LangSwitch.vue';
export default { components: { TermsText, LangSwitch }, data() { return { ms: false }; } };
</script>
