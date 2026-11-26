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
