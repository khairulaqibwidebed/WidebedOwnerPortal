<template>
  <div>
    <div class="brand-head"><img src="/logo.png" alt="" /><h1>Create your account</h1>
      <p class="sub">Use the email address Widebed has on file for you.</p></div>
    <form class="card" @submit.prevent="submit" novalidate>
      <label for="em">Email</label>
      <input id="em" v-model.trim="email" type="email" autocomplete="username" inputmode="email" />
      <label for="pw">Password</label>
      <PasswordInput id="pw" v-model="password" autocomplete="new-password" placeholder="Create a password" />
      <ul class="rules" v-if="password"><li v-for="r in rules" :key="r.id" :class="{ met: r.met }">{{ r.met ? '✓' : '○' }} {{ r.label }}</li></ul><p class="hint" v-else>8 or more characters with a capital letter, a small letter, a number and a symbol.</p>
      <label for="pw2">Confirm password</label>
      <PasswordInput id="pw2" v-model="confirm" autocomplete="new-password" placeholder="Re-enter your password" />
      <div v-if="error" class="err">{{ error }}</div>
      <button class="btn block" :disabled="busy">{{ busy ? 'Creating…' : 'Create account' }}</button>
    </form>
    <p class="center hint">Already have an account? <router-link to="/login">Sign in</router-link></p>
  </div>
</template>

<script>
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/firebase.js';
import PasswordInput from '@/components/PasswordInput.vue';
import { friendlyAuthError, passwordProblem, PW_RULES } from '@/lib/format.js';

export default {
  components: { PasswordInput },
  computed: { rules() { return PW_RULES.map(r => ({ ...r, met: r.ok(this.password) })); } },
  data() { return { email: '', password: '', confirm: '', busy: false, error: '' }; },
  methods: {
    async submit() {
      this.error = '';
      if (!this.email) return (this.error = 'Type your email.');
      if (passwordProblem(this.password)) return (this.error = passwordProblem(this.password));
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
