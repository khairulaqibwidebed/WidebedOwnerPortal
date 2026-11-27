<template>
  <div class="gatepage simple">
    <div class="gp-top"><LangSwitch v-model="ms" /></div>
    <div class="gp-card">
      <img src="/logo.png" alt="" class="gp-logo" />
      <h1>{{ ms ? 'Sebelum anda teruskan' : 'Before you continue' }}</h1>
      <p class="sub">{{ ms ? 'Sila semak perkara penting ini untuk menggunakan Portal Pemilik.' : 'Please review these key points to use the Owner Portal.' }}</p>
      <ul class="points">
        <li v-for="p in points" :key="p.t"><span class="pt-ico" v-html="p.i"></span><span><b>{{ p.t }}</b><small>{{ p.d }}</small></span></li>
      </ul>
      <label class="agree">
        <input type="checkbox" v-model="agree" />
        <span v-if="!ms">I agree to the <a href="#" @click.prevent="open('terms')">Terms of Use</a> and the <a href="#" @click.prevent="open('privacy')">Privacy Notice</a>.</span>
        <span v-else>Saya bersetuju dengan <a href="#" @click.prevent="open('terms')">Terma Penggunaan</a> dan <a href="#" @click.prevent="open('privacy')">Notis Privasi</a>.</span>
      </label>
      <div v-if="error" class="err pop">{{ error }}</div>
      <button class="btn block" :class="{ 'is-busy': busy }" :disabled="!agree || busy" @click="accept">{{ busy ? (ms ? 'Menyimpan…' : 'Saving…') : (ms ? 'Setuju dan teruskan' : 'Agree and continue') }}</button>
      <p class="center hint"><button class="link-btn" @click="ask = true">{{ ms ? 'Log keluar' : 'Sign out' }}</button></p>
    </div>
    <Transition name="sheet"><ConfirmDialog v-if="ask" :title="ms ? 'Log keluar?' : 'Sign out?'" :text="ms ? 'Anda perlu e-mel dan kata laluan untuk log masuk semula.' : 'You will need your email and password to sign in again.'" :ok-label="ms ? 'Log keluar' : 'Sign out'" :cancel-label="ms ? 'Batal' : 'Cancel'" :busy-label="ms ? 'Sedang log keluar…' : 'Signing out…'" :busy="leaving" @cancel="ask = false" @confirm="out" /></Transition>
    <Transition name="sheet"><LegalModal v-if="modal" v-model:ms="ms" :start="modal" @close="modal = ''" /></Transition>
  </div>
</template>
<script>
import { signOut } from 'firebase/auth';
import LangSwitch from '@/components/LangSwitch.vue';
import LegalModal from '@/components/LegalModal.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { auth } from '@/firebase.js';
import { call } from '@/lib/api.js';
import { session } from '@/lib/session.js';
import { DISPUTE_DAYS } from '@/lib/legal.js';
const I = p => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export default {
  components: { LangSwitch, LegalModal, ConfirmDialog },
  data() { return { ms: false, modal: '', agree: false, busy: false, error: '', days: DISPUTE_DAYS, ask: false, leaving: false }; },
  computed: {
    points() {
      const d = this.days, mail = I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'), clock = I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), lock = I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
      return this.ms ? [
        { i: mail, t: 'Penyata dihantar secara elektronik', d: 'Penyata, rekod bayaran dan slip bayaran anda dihantar dalam portal ini.' },
        { i: clock, t: `${d} hari untuk melaporkan kesilapan`, d: 'Beritahu Widebed jika anda nampak kesilapan dalam penyata.' },
        { i: lock, t: 'Data anda dilindungi', d: 'Kami mengendalikan data peribadi anda di bawah PDPA 2010 dan tidak menjualnya.' }
      ] : [
        { i: mail, t: 'Statements are delivered electronically', d: 'Your statements, payment records and pay slips are delivered in this portal.' },
        { i: clock, t: `${d} days to report an error`, d: 'Tell Widebed if you see a mistake in a statement.' },
        { i: lock, t: 'Your data is protected', d: 'We handle your personal data under the PDPA 2010 and do not sell it.' }
      ];
    }
  },
  methods: {
    open(t) { this.modal = t; },
    async accept() {
      if (!this.agree) return;
      this.busy = true; this.error = '';
      try { const r = await call('acceptTerms'); session.terms = r.terms; this.$router.replace('/units'); }
      catch (e) { this.error = e.message; } finally { this.busy = false; }
    },
    async out() { this.leaving = true; try { await signOut(auth); session.terms = null; this.ask = false; this.$router.replace('/login'); } finally { this.leaving = false; } }
  }
};
</script>
