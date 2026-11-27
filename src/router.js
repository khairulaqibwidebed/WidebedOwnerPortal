import { createRouter, createWebHistory } from 'vue-router';
import { session, whenReady } from '@/lib/session.js';
import { call } from '@/lib/api.js';

const routes = [
  { path: '/login', component: () => import('@/pages/Login.vue'), meta: { public: true } },
  { path: '/register', component: () => import('@/pages/Register.vue'), meta: { public: true } },
  { path: '/verify', component: () => import('@/pages/Verify.vue'), meta: { verify: true } },
  { path: '/', redirect: '/units' },
  { path: '/units', component: () => import('@/pages/Units.vue'), meta: { title: 'Property and Units' } },
  { path: '/units/:id', component: () => import('@/pages/UnitDetail.vue'), meta: { title: 'Unit' } },
  { path: '/stays', component: () => import('@/pages/Stays.vue'), meta: { title: 'Check-ins and check-outs' } },
  { path: '/payments', component: () => import('@/pages/Payments.vue'), meta: { title: 'Payments' } },
  { path: '/maintenance', component: () => import('@/pages/Maintenance.vue'), meta: { title: 'Maintenance' } },
  { path: '/maintenance/:id', component: () => import('@/pages/Repair.vue'), meta: { title: 'Repair' } },
  { path: '/terms', component: () => import('@/pages/Terms.vue'), meta: { title: 'Terms and Privacy', open: true } },
  { path: '/accept-terms', component: () => import('@/pages/AcceptTerms.vue'), meta: { gate: true } },
  { path: '/profile', component: () => import('@/pages/Profile.vue'), meta: { title: 'Profile' } },
  { path: '/:rest(.*)', redirect: '/' }
];
// New page opens at the top (after the old page has faded out); Back returns to where you were. Tab changes inside a page keep the scroll.
const scrollBehavior = (to, from, saved) => {
  if (to.path === from.path) return false;
  return new Promise(r => setTimeout(() => r(saved ? { ...saved, behavior: 'instant' } : { top: 0, behavior: 'instant' }), 110));
};
const router = createRouter({ history: createWebHistory(), routes, scrollBehavior });

router.beforeEach(async to => {
  await whenReady;
  if (to.meta.open) return true;
  const signedIn = !!session.user;
  if (!signedIn) return to.meta.public ? true : '/login';
  if (!session.verified) return to.meta.verify ? true : '/verify';
  if (to.meta.public || to.meta.verify) return '/units';
  // First time in (or the terms changed): they must agree before anything else
  if (!session.terms) { try { session.terms = (await call('terms')).terms; } catch { /* offline or server problem: do not lock them out; asked again next time */ } }
  if (session.terms && !session.terms.accepted) return to.meta.gate ? true : '/accept-terms';
  if (to.meta.gate) return '/units';
  return true;
});
export default router;
