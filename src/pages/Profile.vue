<template>
  <div>
  <h1 class="page-h">Profile</h1>
  <p class="page-sub">Your account details.</p>
  <Loader :loading="loading" :error="error" :count="2" :rows="2" @retry="load">
    <div class="card">
      <div class="row"><span>Name</span><span>{{ profile.name || '—' }}</span></div>
      <div class="row"><span>Email</span><span>{{ profile.email }}</span></div>
    </div>
    <router-link to="/terms" class="card trow">
      <span class="t-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></span>
      <span class="t-txt"><b>Terms of Use and Privacy Notice</b><small>{{ accepted ? `You agreed on ${accepted}. Tap to read.` : 'Tap to read how we use your information.' }}</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </router-link>
    <p class="hint">To change your name or email, please contact Widebed.</p>
    <h2>Change password</h2>
    <form class="card pwform" @submit.prevent="change" novalidate>
      <label for="cur">Current password</label><PasswordInput id="cur" v-model="cur" autocomplete="current-password" placeholder="Enter your current password" />
      <label for="n1">New password</label><PasswordInput id="n1" v-model="n1" autocomplete="new-password" placeholder="Create a password" />
      <ul class="rules" v-if="n1"><li v-for="r in rules" :key="r.id" :class="{ met: r.met }">{{ r.met ? '✓' : '○' }} {{ r.label }}</li></ul>
      <label for="n2">Confirm new password</label><PasswordInput id="n2" v-model="n2" autocomplete="new-password" placeholder="Re-enter your password" />
      <div v-if="mismatch" class="hint warn">The two new passwords are not the same yet.</div>
      <div v-if="pwErr" class="err">{{ pwErr }}</div><div v-if="pwOk" class="ok pop">✓ Your password has been changed.</div>
      <button class="btn block" :disabled="busy || !ready">{{ busy ? 'Saving…' : 'Change password' }}</button>
    </form>
    <button class="btn ghost block press" @click="out">Sign out</button>
  </Loader>
  </div>
</template>
<script>
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import Loader from '@/components/Loader.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { auth } from '@/firebase.js';
import { call } from '@/lib/api.js';
import { session } from '@/lib/session.js';
import { friendlyAuthError, passwordProblem, PW_RULES, dmy } from '@/lib/format.js';
export default {
  components: { Loader, PasswordInput },
  computed: {
    accepted() { const a = session.terms?.acceptedAt; return a ? dmy(a.slice(0, 10)) : ''; },
    ready() { return !!(this.cur && this.n1 && this.n2) && !passwordProblem(this.n1); },
    rules() { return PW_RULES.map(r => ({ ...r, met: r.ok(this.n1) })); },
    mismatch() { return !!this.n2 && this.n1 !== this.n2; }
  },
  data() { return { loading: true, error: '', profile: { name: '', email: '' }, cur: '', n1: '', n2: '', busy: false, pwErr: '', pwOk: false }; },
  mounted() { this.load(); },
  methods: {
    async load() { this.loading = true; this.error = ''; try { this.profile = (await call('overview')).profile; } catch (e) { this.error = e.message; } finally { this.loading = false; } },
    async change() {
      this.pwErr = ''; this.pwOk = false;
      if (!this.cur) return (this.pwErr = 'Type your current password.');
      if (passwordProblem(this.n1)) return (this.pwErr = passwordProblem(this.n1).replace('The password', 'The new password'));
      if (this.n1 !== this.n2) return (this.pwErr = 'The two new passwords are not the same.');
      this.busy = true;
      try {
        const u = auth.currentUser;
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, this.cur));
        await updatePassword(u, this.n1);
        this.pwOk = true; this.cur = this.n1 = this.n2 = '';
      } catch (e) { this.pwErr = friendlyAuthError(e); }
      finally { this.busy = false; }
    },
    async out() { session.terms = null; await signOut(auth); this.$router.replace('/login'); }
  }
};
</script>
