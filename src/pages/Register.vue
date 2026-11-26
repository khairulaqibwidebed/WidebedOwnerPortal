<template>
  <div>
    <div class="brand-head"><img src="/favicon.svg" alt="" /><h1>Create your account</h1>
      <p class="sub">Use the email address Widebed has on file for you.</p></div>
    <form class="card" @submit.prevent="submit" novalidate>
      <label for="em">Email</label>
      <input id="em" v-model.trim="email" type="email" autocomplete="username" inputmode="email" />
      <label for="pw">Password</label>
      <input id="pw" v-model="password" type="password" autocomplete="new-password" />
      <p class="hint">At least 8 characters.</p>
      <label for="pw2">Confirm password</label>
      <input id="pw2" v-model="confirm" type="password" autocomplete="new-password" />
      <div v-if="error" class="err">{{ error }}</div>
      <button class="btn block" :disabled="busy">{{ busy ? 'Creating…' : 'Create account' }}</button>
    </form>
    <p class="center hint">Already have an account? <router-link to="/login">Sign in</router-link></p>
  </div>
</template>

<script>
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/firebase.js';
import { friendlyAuthError } from '@/lib/format.js';

export default {
  data() { return { email: '', password: '', confirm: '', busy: false, error: '' }; },
  methods: {
    async submit() {
      this.error = '';
      if (!this.email) return (this.error = 'Type your email.');
      if (this.password.length < 8) return (this.error = 'The password needs at least 8 characters.');
      if (this.password !== this.confirm) return (this.error = 'The two passwords are not the same.');
      this.busy = true;
      try {
        // The server checks the email is an owner in Widebed's system before the account is made
        const r = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: this.email, password: this.password }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Could not create the account. Please try again.');
        const cred = await signInWithEmailAndPassword(auth, this.email, this.password);
        await sendEmailVerification(cred.user);
        this.$router.replace('/verify');
      } catch (e) { this.error = e.code ? friendlyAuthError(e) : e.message; }
      finally { this.busy = false; }
    }
  }
};
</script>
