// Sign-in lockout (26 Nov 2026): talks to api/login-guard.js. 5 wrong passwords for one email in 15 minutes locks it for 15 minutes.
// If the check can't be reached (local "npm run dev" without /api, or the server is down), sign-in carries on the usual way.
// -> { ok: true } | { ok: false, error, left, code } | { skip: true }
export async function guardAttempt(email, password) {
  try {
    const r = await fetch('/api/login-guard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => null);
    if (!j || r.status >= 500 || j.unavailable) { console.warn('[login-guard] check not available, signing in without it.', r.status, j?.error || ''); return { skip: true }; }
    if (r.ok) return { ok: true };
    return { ok: false, error: j.error, left: j.left, code: j.code };
  } catch (e) {
    console.warn('[login-guard] check not available, signing in without it.', e);
    return { skip: true };
  }
}
