// POST /api/register   { email, password }
// Creates a portal login only when the email belongs to an owner (or co-owner) in the PMS. The person then verifies
// their email (the page sends the Firebase verification email after signing in) before any data is shown.
// Anyone can still call Firebase's own sign-up with the public API key, but such an account sees nothing: every data
// request in api/portal.js checks the PMS match and a verified email again.
import { HttpError, lower, matchEmail, send, fail } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only.');
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const email = lower(b.email), password = String(b.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) throw new HttpError(400, 'Type a valid email address.');
    if (password.length < 8 || password.length > 128) throw new HttpError(400, 'The password needs at least 8 characters.');
    if (!(await matchEmail(email))) throw new HttpError(403, 'This email is not registered as an owner with Widebed. Please contact us, or use the email address Widebed has for you.');
    const apiKey = process.env.PORTAL_FIREBASE_API_KEY;
    if (!apiKey) throw new HttpError(500, 'PORTAL_FIREBASE_API_KEY is not set on the server.');
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: false }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code = j.error?.message || '';
      if (code.startsWith('EMAIL_EXISTS')) throw new HttpError(409, 'This email already has an account. Please sign in (or use Forgot password).');
      if (code.startsWith('WEAK_PASSWORD')) throw new HttpError(400, 'Choose a stronger password (at least 8 characters).');
      throw new HttpError(502, 'Could not create the account. Please try again.');
    }
    send(res, 200, { ok: true });
  } catch (e) { fail(res, e); }
}
