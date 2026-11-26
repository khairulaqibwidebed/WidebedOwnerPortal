// Calls to the portal's own server functions (api/*.js). Every call carries the owner's sign-in token.
import { auth } from '@/firebase.js';

export async function call(action, body = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error('Please sign in again.');
  const token = await u.getIdToken();
  let r;
  try {
    r = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...body }) });
  } catch { throw new Error(navigator.onLine ? 'Could not reach the server. Please try again.' : "You're offline. Connect to the internet and try again."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j;
}
// Address of one photo, video or pay slip (kind 'ticket' | 'slip'). The token is short-lived and used only on this site.
export async function fileUrl(kind, id, fileId) {
  const t = await auth.currentUser.getIdToken();
  return `/api/file?k=${kind}&id=${encodeURIComponent(id)}&f=${encodeURIComponent(fileId)}&t=${encodeURIComponent(t)}`;
}
