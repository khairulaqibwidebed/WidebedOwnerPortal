<template>
  <div>
    <div class="brand-head"><img src="/logo.png" alt="" /><h1>Check your email</h1></div>
    <div class="card">
      <p style="margin-top:0">We sent a link to <b>{{ email }}</b>. Open it to confirm this is your email, then come back here.</p>
      <button class="btn block" :disabled="busy" @click="check">I've confirmed my email</button>
      <button class="btn ghost block" :disabled="busy || cooldown" @click="resend">{{ cooldown ? 'Email sent' : 'Send the email again' }}</button>
      <div v-if="msg" class="ok">{{ msg }}</div>
      <div v-if="error" class="err">{{ error }}</div>
    </div>
    <p class="center hint"><button class="link-btn" @click="out">Use a different account</button></p>
  </div>
</template>

<script>
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '@/firebase.js';
import { session } from '@/lib/session.js';
import { friendlyAuthError } from '@/lib/format.js';

export default {
  data() { return { busy: false, msg: '', error: '', cooldown: false }; },
  computed: { email() { return session.user?.email || ''; } },
  methods: {
    async check() {
      this.error = this.msg = ''; this.busy = true;
      try {
        await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
        if (auth.currentUser.emailVerified) { session.verified = true; this.$router.replace('/units'); }
        else this.error = 'Not confirmed yet. Open the link in the email first.';
      } catch (e) { this.error = friendlyAuthError(e); }
      finally { this.busy = false; }
    },
    async resend() {
      this.error = this.msg = ''; this.busy = true;
      try { await sendEmailVerification(auth.currentUser); this.msg = 'Sent. Please also look in your spam folder.'; this.cooldown = true; setTimeout(() => (this.cooldown = false), 30000); }
      catch (e) { this.error = friendlyAuthError(e); }
      finally { this.busy = false; }
    },
    async out() { await signOut(auth); this.$router.replace('/login'); }
  }
};
</script>
