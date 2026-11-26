import { createRouter, createWebHistory } from 'vue-router';
import { session, whenReady } from '@/lib/session.js';

const routes = [
  { path: '/login', component: () => import('@/pages/Login.vue'), meta: { public: true } },
  { path: '/register', component: () => import('@/pages/Register.vue'), meta: { public: true } },
  { path: '/verify', component: () => import('@/pages/Verify.vue'), meta: { verify: true } },
  { path: '/', redirect: '/units' },
  { path: '/units', component: () => import('@/pages/Units.vue'), meta: { title: 'Property and Units' } },
  { path: '/stays', component: () => import('@/pages/Stays.vue'), meta: { title: 'Check-ins and check-outs' } },
  { path: '/payments', component: () => import('@/pages/Payments.vue'), meta: { title: 'Payments' } },
  { path: '/maintenance', component: () => import('@/pages/Maintenance.vue'), meta: { title: 'Maintenance' } },
  { path: '/profile', component: () => import('@/pages/Profile.vue'), meta: { title: 'Profile' } },
  { path: '/:rest(.*)', redirect: '/' }
];
const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async to => {
  await whenReady;
  const signedIn = !!session.user;
  if (!signedIn) return to.meta.public ? true : '/login';
  if (!session.verified) return to.meta.verify ? true : '/verify';
  if (to.meta.public || to.meta.verify) return '/units';
  return true;
});
export default router;
