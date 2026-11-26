<template>
  <div class="legal">
    <div class="seg" style="--n:2" :style="{ '--i': tab === 'terms' ? 0 : 1 }">
      <button type="button" :class="{ on: tab === 'terms' }" @click="tab = 'terms'">{{ ms ? 'Terma Penggunaan' : 'Terms of Use' }}</button>
      <button type="button" :class="{ on: tab === 'privacy' }" @click="tab = 'privacy'">{{ ms ? 'Notis Privasi' : 'Privacy Notice' }}</button>
    </div>
    <div class="card prose legal-scroll" :key="tab + ms">
      <template v-if="tab === 'terms'">
        <p class="intro">{{ ms ? 'Sila baca terma ini. Ia menerangkan cara anda boleh menggunakan portal dan cara penyata serta maklumat anda dikendalikan.' : 'Please read these terms. They explain how you may use the portal and how your statements and information are handled.' }}</p>
        <Block v-for="s in (ms ? TERMS_MS : TERMS_EN)" :key="s.h" :s="s" />
      </template>
      <template v-else>
        <Block v-for="s in (ms ? PRIVACY_MS : PRIVACY_EN)" :key="s.h" :s="s" />
      </template>
    </div>
    <p class="draftnote">{{ ms ? 'Draf teks, menunggu semakan peguam Widebed.' : 'Draft wording, pending review by Widebed\'s legal counsel.' }}</p>
  </div>
</template>
<script>
import { TERMS_EN, TERMS_MS, PRIVACY_EN, PRIVACY_MS } from '@/lib/legal.js';
import Block from '@/components/LegalBlock.vue';
export default { components: { Block }, props: { ms: { type: Boolean, default: false }, start: { type: String, default: 'terms' } }, emits: ['tab'], watch: { tab: { immediate: true, handler(t) { this.$emit('tab', t); } } }, data() { return { tab: this.start, TERMS_EN, TERMS_MS, PRIVACY_EN, PRIVACY_MS }; } };
</script>
