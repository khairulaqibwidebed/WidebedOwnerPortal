<template>
  <Loader :loading="loading" :error="error" @retry="load">
    <div class="card">
      <div class="row"><span>Name</span><span>{{ profile.name || '—' }}</span></div>
      <div class="row"><span>Email</span><span>{{ profile.email }}</span></div>
    </div>
    <p class="hint">To change your name or email, please contact Widebed.</p>
    <h2>Change password</h2>
    <form class="card" @submit.prevent="change" novalidate>
      <label for="cur">Current password</label><input id="cur" v-model="cur" type="password" autocomplete="current-password" />
      <label for="n1">New password</label><input id="n1" v-model="n1" type="password" autocomplete="new-password" />
      <label for="n2">Confirm new password</label><input id="n2" v-model="n2" type="password" autocomplete="new-password" />
      <div v-if="pwErr" class="err">{{ pwErr }}</div><div v-if="pwOk" class="ok">Your password has been changed.</div>
      <button class="btn block" :disabled="busy">{{ busy ? 'Saving…' : 'Change password' }}</button>
    </form>
    <button class="btn ghost block" @click="out">Sign out</button>
  </Loader>
</template>
<script>
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import Loader from '@/components/Loader.vue';
import { auth } from '@/firebase.js';
import { call } from '@/lib/api.js';
import { friendlyAuthError } from '@/lib/format.js';
export default {
  components: { Loader },
  data() { return { loading: true, error: '', profile: { name: '', email: '' }, cur: '', n1: '', n2: '', busy: false, pwErr: '', pwOk: false }; },
  mounted() { this.load(); },
  methods: {
    async load() { this.loading = true; this.error = ''; try { this.profile = (await call('overview')).profile; } catch (e) { this.error = e.message; } finally { this.loading = false; } },
    async change() {
      this.pwErr = ''; this.pwOk = false;
      if (!this.cur) return (this.pwErr = 'Type your current password.');
      if (this.n1.length < 8) return (this.pwErr = 'The new password needs at least 8 characters.');
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
    async out() { await signOut(auth); this.$router.replace('/login'); }
  }
};
</script>
