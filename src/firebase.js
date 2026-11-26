// The PORTAL's own Firebase project (Authentication only). Values come from Vercel / .env.local variables named VITE_FIREBASE_*.
// These are public web settings, not secrets, but they live in the environment so each project (test, live) can use its own.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const env = import.meta.env;
export const configured = !!(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY || 'missing', authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'missing', appId: env.VITE_FIREBASE_APP_ID || '' });
export const auth = getAuth(app);
