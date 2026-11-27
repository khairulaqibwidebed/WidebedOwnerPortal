<template>
  <div>
    <div class="brand-head"><img src="/logo.png" alt="" /><h1>Widebed Owner Portal</h1><p class="sub">Sign in to see your units, stays and payments.</p></div>
    <form class="card" @submit.prevent="submit" novalidate>
      <template v-if="!forgot">
        <label for="em">Email</label>
        <input id="em" v-model.trim="email" type="email" autocomplete="username" inputmode="email" />
        <label for="pw">Password</label>
        <PasswordInput id="pw" v-model="password" autocomplete="current-password" placeholder="Enter your password" />
        <div v-if="error" class="err pop">{{ error }}</div>
        <button class="btn block" :class="{ 'is-busy': busy }" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
        <p class="hint center"><button type="button" class="link-btn" @click="forgot = true; error = ''">Forgot password?</button></p>
      </template>
      <template v-else>
        <label for="em2">Your email</label>
        <input id="em2" v-model.trim="email" type="email" autocomplete="username" inputmode="email" />
        <div v-if="error" class="err pop">{{ error }}</div>
        <div v-if="sent" class="ok">If this email has an account, a link to choose a new password is on its way.</div>
        <button class="btn block" :class="{ 'is-busy': busy }" :disabled="busy">{{ busy ? 'Sending…' : 'Send reset link' }}</button>
        <p class="hint center"><button type="button" class="link-btn" @click="forgot = false; sent = false; error = ''">Back to sign in</button></p>
      </template>
    </form>
    <p class="center hint">First time? <router-link to="/register">Create your account</router-link></p>
  </div>
</template>

<script>
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase.js';
import { friendlyAuthError } from '@/lib/format.js';
import { guardAttempt } from '@/lib/login-guard.js';
import PasswordInput from '@/components/PasswordInput.vue';

export default {
  components: { PasswordInput },
  data() { return { email: '', password: '', busy: false, error: '', forgot: false, sent: false }; },
  methods: {
    async submit() {
      this.error = '';
      if (!this.email) return (this.error = 'Type your email.');
      this.busy = true;
      try {
        if (this.forgot) { await sendPasswordResetEmail(auth, this.email).catch(e => { if (e.code !== 'auth/user-not-found') throw e; }); this.sent = true; return; }
        if (!this.password) return (this.error = 'Type your password.');
        // 26 Nov 2026: the server checks the password first and counts wrong ones (api/login-guard.js)
        const g = await guardAttempt(this.email, this.password);
        if (g.ok === false) {
          this.error = g.code === 'auth/invalid-credential' && g.left > 0 && g.left <= 3
            ? `${g.error} ${g.left} ${g.left === 1 ? 'try' : 'tries'} left before sign-in is locked for 15 minutes.` : g.error;
          return;
        }
        await signInWithEmailAndPassword(auth, this.email, this.password);
        this.$router.replace('/units');
      } catch (e) { this.error = friendlyAuthError(e); }
      finally { this.busy = false; }
    }
  }
};
</script>
