// Shared server code for the Widebed Owner Portal functions (files starting with _ are not made into functions by Vercel).
//
// How the portal reaches the PMS (a different Firebase project):
//   1. The owner signs in to the PORTAL project (Firebase Auth). The browser sends that ID token to /api/portal.
//   2. This code checks the token with the portal's API key, then needs the email to be VERIFIED.
//   3. It finds the PMS owner whose contact email (or a co-owner's email) matches, remembers the link in the portal's
//      own Firestore (ownerLinks/{uid}), and re-checks the match on every request.
//   4. It reads the PMS with the PMS service account (read only, server side) and returns ONLY that owner's data,
//      with private fields left out. The browser never talks to the PMS.
// Vercel variables (never in git or chat):
//   PORTAL_FIREBASE_API_KEY  the portal project's Web API key (Project settings > General)
//   PORTAL_ADMIN_JSON        service account key of the PORTAL project (writes ownerLinks)
//   PMS_ADMIN_JSON           service account key of widebed-pmsdashboard (READ only in practice; use a role of
//                            Cloud Datastore Viewer if you can)
//   Drive (same names as the PMS uses): DRIVE_SCRIPT_URL + DRIVE_SCRIPT_KEY, or GOOGLE_SERVICE_ACCOUNT_JSON + DRIVE_ROOT_FOLDER_ID
import { createSign } from 'node:crypto';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
export const lower = s => String(s || '').trim().toLowerCase();

export function serviceKey(envName) {
  try { const k = JSON.parse(process.env[envName] || ''); if (k.client_email && k.private_key && k.project_id) return k; } catch { /* below */ }
  throw new HttpError(500, `${envName} is missing or not valid on the server.`);
}

const tokens = new Map();
export async function googleToken(key, scope = 'https://www.googleapis.com/auth/datastore') {
  const id = key.client_email + scope, hit = tokens.get(id);
  if (hit && hit.exp > Date.now() + 60000) return hit.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: key.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600, scope });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }) });
  const j = await r.json();
  if (!r.ok) throw new HttpError(500, `Google sign-in failed: ${j.error_description || j.error || r.status}`);
  tokens.set(id, { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 });
  return j.access_token;
}

// ---------- Firestore REST ----------
const val = v => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return plainFields(v.mapValue.fields);
  return undefined;
};
const plainFields = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, val(v)]));
export const plain = doc => ({ id: doc.name.split('/').pop(), ...plainFields(doc.fields) });
// 27 Nov 2026: also Date (a real Firestore time), arrays and plain objects, for the owner booking request and its staff notification
const enc = v => v == null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v }
  : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : Number.isInteger(v) ? { integerValue: String(v) } : typeof v === 'number' ? { doubleValue: v }
  : typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { stringValue: String(v) };
const root = key => `projects/${key.project_id}/databases/(default)/documents`;
const base = key => `https://firestore.googleapis.com/v1/${root(key)}`;

export const pms = () => serviceKey('PMS_ADMIN_JSON');
export const portal = () => serviceKey('PORTAL_ADMIN_JSON');

async function call(key, url, init = {}) {
  const tok = await googleToken(key);
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `Database refused (${r.status}).`);
  return j;
}
export async function getDoc(key, path) {
  const j = await call(key, `${base(key)}/${path}`);
  return j ? plain(j) : null;
}
// Up to 100 documents in one request; returns a map path -> data (missing ones left out)
export async function batchGet(key, paths) {
  const out = {};
  for (let i = 0; i < paths.length; i += 100) {
    const part = paths.slice(i, i + 100);
    const j = await call(key, `${base(key)}:batchGet`, { method: 'POST', body: JSON.stringify({ documents: part.map(p => `${root(key)}/${p}`) }) });
    for (const x of j || []) if (x.found) out[x.found.name.split('/documents/')[1]] = plain(x.found);
  }
  return out;
}
const FILTER = (field, op, value) => ({ fieldFilter: { field: { fieldPath: field }, op, value } });
// Equality filters only (plus IN), so no composite index is ever needed. filters: [[field, 'EQUAL', value] | [field, 'IN', [values]]]
export async function query(key, collection, filters, limit = 2000, select = null) {
  const fs = filters.map(([f, op, v]) => FILTER(f, op, op === 'IN' ? { arrayValue: { values: v.map(enc) } } : enc(v)));
  const structuredQuery = { from: [{ collectionId: collection }], limit, ...(select ? { select: { fields: select.map(f => ({ fieldPath: f })) } } : {}),
    where: fs.length === 1 ? fs[0] : { compositeFilter: { op: 'AND', filters: fs } } };
  const j = await call(key, `${base(key)}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
  return (j || []).filter(x => x.document).map(x => plain(x.document));
}
export async function listIds(key, collection) {
  const ids = []; let page = '';
  do {
    const j = await call(key, `${base(key)}/${collection}?pageSize=300&mask.fieldPaths=active${page ? `&pageToken=${page}` : ''}`);
    for (const d of j?.documents || []) ids.push(plain(d));
    page = j?.nextPageToken || '';
  } while (page);
  return ids;
}
// Documents of a sub-collection, e.g. units/{id}/ownership
export async function listSub(key, path) {
  const j = await call(key, `${base(key)}/${path}?pageSize=100`);
  return (j?.documents || []).map(plain);
}
export async function setDoc(key, path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)]));
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  await call(key, `${base(key)}/${path}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
}
export async function deleteDoc(key, path) { await call(key, `${base(key)}/${path}`, { method: 'DELETE' }); }

// ---------- Who is calling (portal login) ----------
export async function caller(req, tokenOverride = '') {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const idToken = tokenOverride || m?.[1];
  if (!idToken) throw new HttpError(401, 'Sign in again.');
  const apiKey = process.env.PORTAL_FIREBASE_API_KEY;
  if (!apiKey) throw new HttpError(500, 'PORTAL_FIREBASE_API_KEY is not set on the server.');
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
  const u = (await r.json().catch(() => ({}))).users?.[0];
  if (!r.ok || !u?.localId) throw new HttpError(401, 'Sign in again.');
  if (u.disabled) throw new HttpError(403, 'This account has been switched off. Please contact Widebed.');
  return { uid: u.localId, email: lower(u.email), verified: !!u.emailVerified };
}

// ---------- PMS owners: which owner does an email belong to ----------
// An owner's contact details sit in owners/{id}/private/contact (and private/main for older ones): email, and coOwners [{ fullName, email }].
// Every person with an email on an owner: the contact part AND the full part (they can differ when one was edited later), plus co-owners of either.
function peopleOf(c = {}, m = {}) {
  const out = [], add = (name, email) => { const e = lower(email); if (e && !out.some(x => x.email === e)) out.push({ name: name || '', email: e }); };
  add(c.fullName || m.fullName, c.email); add(m.fullName || c.fullName, m.email);
  for (const list of [c.coOwners, m.coOwners]) for (const x of Array.isArray(list) ? list : []) add(x?.fullName, x?.email);
  return out;
}
const ownerCache = { at: 0, list: null };
async function ownerContacts() {
  if (ownerCache.list && Date.now() - ownerCache.at < 60000) return ownerCache.list;
  const k = pms();
  const owners = await listIds(k, 'owners');
  const paths = owners.flatMap(o => [`owners/${o.id}/private/contact`, `owners/${o.id}/private/main`]);
  const docs = await batchGet(k, paths);
  const list = owners.map(o => {
    const c = docs[`owners/${o.id}/private/contact`] || {}, m = docs[`owners/${o.id}/private/main`] || {};
    const people = peopleOf(c, m);
    return { id: o.id, active: o.active !== false, people };
  });
  Object.assign(ownerCache, { at: Date.now(), list });
  return list;
}
// { ownerId, name } for an email, or null. A switched-off owner cannot register.
export async function matchEmail(email) {
  const e = lower(email);
  if (!e) return null;
  for (const o of await ownerContacts()) {
    if (!o.active) continue;
    const p = o.people.find(x => x.email === e);
    if (p) return { ownerId: o.id, name: p.name };
  }
  return null;
}
// The owner of a verified portal login. The link is kept in the portal's own Firestore; the email is checked again every time.
const ctxCache = new Map();
export async function ownerOf(user) {
  if (!user.verified) throw new HttpError(403, 'Please verify your email first. Check your inbox for the Widebed link.');
  const hit = ctxCache.get(user.uid);
  if (hit && Date.now() - hit.at < 60000 && hit.email === user.email) return hit.value;
  const link = await getDoc(portal(), `ownerLinks/${user.uid}`);
  let found = null;
  if (link?.ownerId && lower(link.email) === user.email) {
    const k = pms();
    const d = await batchGet(k, [`owners/${link.ownerId}`, `owners/${link.ownerId}/private/contact`, `owners/${link.ownerId}/private/main`]);
    const o = d[`owners/${link.ownerId}`], c = d[`owners/${link.ownerId}/private/contact`] || {}, m = d[`owners/${link.ownerId}/private/main`] || {};
    if (o && o.active !== false) {
      const people = peopleOf(c, m);
      const p = people.find(x => x.email === user.email);
      if (p) found = { ownerId: link.ownerId, name: p.name };
    }
  }
  if (!found) {
    found = await matchEmail(user.email);
    if (found) await setDoc(portal(), `ownerLinks/${user.uid}`, { ownerId: found.ownerId, email: user.email });
    else {
      await deleteDoc(portal(), `ownerLinks/${user.uid}`).catch(() => {});
      throw new HttpError(403, 'This email is not registered as an owner with Widebed. Please contact us.');
    }
  }
  const value = { ownerId: found.ownerId, name: found.name || '' };
  ctxCache.set(user.uid, { at: Date.now(), email: user.email, value });
  return value;
}

// ---------- Google Drive (read only, same access the PMS uses) ----------
const API = 'https://www.googleapis.com/drive/v3';
let drv = { token: '', exp: 0, root: '' };
export async function driveToken() {
  if (drv.token && drv.exp > Date.now() + 60000) return drv.token;
  if (process.env.DRIVE_SCRIPT_URL) {
    let j;
    try {
      const r = await fetch(process.env.DRIVE_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'token', key: process.env.DRIVE_SCRIPT_KEY || '' }) });
      j = await r.json();
    } catch { throw new HttpError(502, 'Could not reach the company Drive script.'); }
    if (!j.ok || !j.token) throw new HttpError(500, `Drive script: ${j.error || 'no token'}`);
    drv = { token: j.token, exp: Date.now() + (j.expiresIn || 2700) * 1000, root: j.rootFolderId || '' };
    return drv.token;
  }
  const key = serviceKey('GOOGLE_SERVICE_ACCOUNT_JSON');
  const t = await googleToken(key, 'https://www.googleapis.com/auth/drive.readonly');
  drv = { token: t, exp: Date.now() + 3000000, root: process.env.DRIVE_ROOT_FOLDER_ID || '' };
  return t;
}
export const driveRoot = () => { if (!drv.root) throw new HttpError(500, 'The uploads folder is not set up (DRIVE_ROOT_FOLDER_ID).'); return drv.root; };
export async function dg(path, tok, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { Authorization: `Bearer ${tok}`, ...(opts.headers || {}) } });
  if (!r.ok && r.status !== 206) throw new HttpError(502, `Drive refused this (${r.status}).`);
  return r;
}
const qs = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
export const DRIVE_API = API;
export async function listFolder(tok, folderId) {
  const url = `${API}/files?q=${encodeURIComponent(`'${qs(folderId)}' in parents and trashed=false`)}&fields=files(id,name,mimeType,size,createdTime)&orderBy=createdTime desc&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  return ((await (await dg(url, tok)).json()).files || []);
}
export async function fileMeta(tok, fileId) {
  return (await (await dg(`${API}/files/${fileId}?fields=id,name,mimeType,size,parents&supportsAllDrives=true`, tok)).json());
}
// The Owner Payments folder of one statement: "<unit> <month> (<last 5 of id>)" under Owner Payments/<month folder>. null if none.
export async function payslipFolder(tok, statementId, unitCode, month) {
  const tag = statementId.slice(-5), want = `${unitCode} ${month} (${tag})`;
  const hits = ((await (await dg(`${API}/files?q=${encodeURIComponent(`name contains '(${qs(tag)})' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name,parents)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=50`, tok)).json()).files || [])
    .filter(f => f.name.replace(/\s+/g, ' ').trim() === want);
  if (!hits.length) return null;
  const kind = (await (await dg(`${API}/files?q=${encodeURIComponent(`'${qs(driveRoot())}' in parents and name='Owner Payments' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, tok)).json()).files?.[0]?.id;
  if (!kind) return null;
  for (const h of hits) {
    let ids = h.parents || [];
    for (let depth = 0; depth < 3 && ids.length; depth++) {
      if (ids.includes(kind)) return h.id;
      ids = (await (await dg(`${API}/files/${ids[0]}?fields=parents&supportsAllDrives=true`, tok)).json()).parents || [];
    }
  }
  return null;
}

// ---------- small helpers ----------
export const monthOf = iso => String(iso || '').slice(0, 7);
export const myDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
export function monthsBack(n, ahead = 0) {
  const d = new Date(Date.now() + 8 * 3600e3), out = [];
  for (let i = -ahead; i < n; i++) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); out.push(x.toISOString().slice(0, 7)); }
  return out;
}
export function send(res, status, body) { res.status(status).json(body); }
export function fail(res, e) {
  if (!e.status || process.env.PORTAL_DEBUG) console.error("[portal]", e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Please try again.' });
  if (!e.status) console.error('[portal]', e);
}
