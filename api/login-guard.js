// POST /api/login-guard   { email, password }   Sign-in lockout (26 Nov 2026)
// The sign-in page calls this BEFORE signing in with Firebase. The server checks the password with Firebase itself and
// counts wrong ones:
//   - 5 wrong passwords for one email within 15 minutes -> that email is locked for 15 minutes;
//   - 20 wrong passwords from one internet address (IP) within 15 minutes -> that address is locked for 15 minutes.
// A right password clears that email's count. Answers 200 { ok } | 401 wrong (with tries left) | 423 locked |
// 403 switched off | 429 Firebase's own limit | 503 { unavailable } (the page then signs in the usual way).
// Counts live in the PORTAL Firestore, loginGuard/{e_<hash of email> | i_<hash of address>}; the portal rules deny every
// browser request, so only this service account reads them. The email and address are stored only as a hash.
// Vercel variables (already set for api/register.js and api/portal.js, nothing new): PORTAL_ADMIN_JSON, PORTAL_FIREBASE_API_KEY.
import { createHash } from 'node:crypto';
import { HttpError, lower, portal, getDoc, setDoc, deleteDoc } from './_lib.js';

export const MAX_EMAIL = 5, MAX_IP = 20, WINDOW_MS = 15 * 60e3, LOCK_MS = 15 * 60e3;
const WRONG = ['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND'];
const hash = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 40);
const ipOf = req => String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown';
const myTime = ms => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' });
const lockedMsg = until => `Too many wrong passwords. Sign-in is locked until ${myTime(until)} (Malaysia time). You can use Forgot password meanwhile.`;
const lockOf = (d, now) => (d && d.lockedUntil > now ? d.lockedUntil : 0);
class GuardError extends HttpError { constructor(status, message, extra = {}) { super(status, message); this.extra = extra; } }

async function bump(key, path, max, now) {
  const d = (await getDoc(key, path)) || {};
  const fresh = !d.firstAt || now - d.firstAt > WINDOW_MS;
  const count = (fresh ? 0 : d.count || 0) + 1;
  const lockedUntil = count >= max ? now + LOCK_MS : 0;
  // When it locks, the count starts again from 0, so after the 15 minutes they get 5 fresh tries
  await setDoc(key, path, lockedUntil ? { count: 0, firstAt: 0, lockedUntil } : { count, firstAt: fresh ? now : d.firstAt, lockedUntil: 0 });
  return { count, lockedUntil };
}

async function checkPassword(email, password) {
  const apiKey = process.env.PORTAL_FIREBASE_API_KEY;
  if (!apiKey) throw new GuardError(503, 'PORTAL_FIREBASE_API_KEY is not set on the server.', { unavailable: true });
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: false }) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, code: String(j.error?.message || r.status).split(' ')[0].split(':')[0] };
}

async function attempt(req, body) {
  const email = lower(body.email), password = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) throw new GuardError(400, 'Type a valid email address.');
  if (!password || password.length > 4096) throw new GuardError(400, 'Type your password.');
  const key = portal(), now = Date.now();
  const ePath = `loginGuard/e_${hash(email)}`, iPath = `loginGuard/i_${hash(ipOf(req))}`;
  const [e, i] = await Promise.all([getDoc(key, ePath), getDoc(key, iPath)]);
  const lockedNow = Math.max(lockOf(e, now), lockOf(i, now));
  if (lockedNow) throw new GuardError(423, lockedMsg(lockedNow), { lockedUntil: lockedNow, code: 'locked' });

  const c = await checkPassword(email, password);
  if (c.ok) { if (e) await deleteDoc(key, ePath); return { ok: true }; }
  if (WRONG.includes(c.code)) {
    const [be, bi] = await Promise.all([bump(key, ePath, MAX_EMAIL, now), bump(key, iPath, MAX_IP, now)]);
    const until = Math.max(be.lockedUntil, bi.lockedUntil);
    if (until) throw new GuardError(423, lockedMsg(until), { lockedUntil: until, code: 'locked' });
    throw new GuardError(401, 'Email or password is not right.', { left: MAX_EMAIL - be.count, code: 'auth/invalid-credential' });
  }
  if (c.code === 'USER_DISABLED') throw new GuardError(403, 'This account has been switched off. Please contact Widebed.', { code: 'auth/user-disabled' });
  if (c.code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw new GuardError(429, 'Too many tries. Please wait a few minutes and try again.', { code: 'auth/too-many-requests' });
  throw new GuardError(503, 'The sign-in check is not available.', { unavailable: true, firebase: c.code });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new GuardError(405, 'POST only.');
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    res.status(200).json(await attempt(req, body));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.status ? e.message : 'The sign-in check is not available.', ...(e.extra || {}), ...(e.status ? {} : { unavailable: true }) });
    if (!e.status || e.status >= 500) console.error('[login-guard]', e);
  }
}
