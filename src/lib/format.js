const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dmy = iso => { const s = String(iso || '').slice(0, 10); return s.length === 10 ? `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}` : ''; };
export const monthName = ym => (ym && ym.length >= 7 ? `${FULL[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : '');
export const rm = v => 'RM ' + (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = v => (v == null ? '' : `${+(Number(v) * 100).toFixed(2)}%`);
export function friendlyAuthError(e) {
  const c = e?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(c)) return 'Email or password is not right.';
  if (c === 'auth/too-many-requests') return 'Too many tries. Please wait a few minutes and try again.';
  if (c === 'auth/network-request-failed') return "Can't reach the internet. Please try again.";
  if (c === 'auth/user-disabled') return 'This account has been switched off. Please contact Widebed.';
  if (c === 'auth/requires-recent-login') return 'Please sign out and sign in again, then change your password.';
  if (c === 'auth/weak-password') return 'Choose a stronger password (at least 8 characters).';
  return e?.message || 'Something went wrong. Please try again.';
}

// "Unit 01-01, Jln Tun Razak, 50400 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur, KualaLumpur, W.P. Kuala Lumpur" -> each place once
export function cleanAddress(parts) {
  const seen = new Set(), out = [];
  const norm = s => s.toLowerCase().replace(/wilayah persekutuan|w\.?p\.?/g, '').replace(/[^a-z0-9]/g, '');
  for (const raw of parts.filter(Boolean).flatMap(p => String(p).split(','))) {
    const t = raw.trim(), k = norm(t);
    if (!t || !k || seen.has(k) || [...seen].some(x => x.length > 4 && k.length > 4 && (x.endsWith(k) || k.endsWith(x)))) continue;
    seen.add(k); out.push(t);
  }
  return out.join(', ');
}

// Job stages as the PMS records them: New -> In progress -> Completed (there is no separate "Scheduled" status)
export const STAGES = ['Reported', 'In progress', 'Completed'];
export const stepOf = status => (status === 'Completed' ? 2 : status === 'In progress' ? 1 : 0);

// "26 Nov 2026, 10:29 AM" in Malaysia time, from an ISO timestamp
export function dateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const o = { timeZone: 'Asia/Kuala_Lumpur' };
  return `${d.toLocaleDateString('en-GB', { ...o, day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { ...o, hour: 'numeric', minute: '2-digit' })}`;
}

// Password rule (KEEP IN STEP with api/register.js): 8+ characters with a capital letter, a lowercase letter, a number and a symbol
export const PW_RULES = [
  { id: 'len', label: '8+ characters', ok: p => p.length >= 8 },
  { id: 'upper', label: 'Capital', ok: p => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Small letter', ok: p => /[a-z]/.test(p) },
  { id: 'num', label: 'Number', ok: p => /[0-9]/.test(p) },
  { id: 'sym', label: 'Symbol', ok: p => /[^A-Za-z0-9]/.test(p) }
];
export const passwordProblem = p => (PW_RULES.every(r => r.ok(p || '')) ? '' : 'The password needs 8 or more characters with a capital letter, a small letter, a number and a symbol.');
