import { reactive } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase.js';

// user: the Firebase user (null when signed out); ready: false until Firebase has said who is signed in
export const session = reactive({ ready: false, user: null, verified: false, terms: null });
export const whenReady = new Promise(resolve => {
  onAuthStateChanged(auth, u => { if (session.user?.uid !== u?.uid) session.terms = null; session.user = u; session.verified = !!u?.emailVerified; session.ready = true; resolve(); });
});
