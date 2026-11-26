// Checks the server functions with a pretend PMS and a pretend portal database (no network, test data only).
// The point: an owner only ever gets their own units, stays, paid statements and visible tickets.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.PMS_ADMIN_JSON = JSON.stringify({ client_email: 'pms@x', private_key: privateKey, project_id: 'pms-test' });
process.env.PORTAL_ADMIN_JSON = JSON.stringify({ client_email: 'portal@x', private_key: privateKey, project_id: 'portal-test' });
process.env.PORTAL_FIREBASE_API_KEY = 'key';

// ---- pretend Firestore ----
const store = { 'pms-test': {}, 'portal-test': {} };
const enc = v => v == null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const docOf = (pid, path) => ({ name: `projects/${pid}/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(store[pid][path]).map(([k, v]) => [k, enc(v)])) });
const dec = v => ('stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'integerValue' in v ? Number(v.integerValue) : v.doubleValue);
const reads = [];
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

const users = {};
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
  if (url.startsWith('https://identitytoolkit.googleapis.com') && url.includes('accounts:lookup')) { const u = users[body.idToken]; return u ? json({ users: [u] }) : json({}, 400); }
  if (url.startsWith('https://identitytoolkit.googleapis.com') && url.includes('accounts:signUp')) { if (users[`new-${body.email}`]) return json({ error: { message: 'EMAIL_EXISTS' } }, 400); users[`new-${body.email}`] = 1; return json({ localId: 'n' }); }
  if (url.startsWith('https://oauth2.googleapis.com')) return json({ access_token: 'tok', expires_in: 3600 });
  const m = /projects\/([^/]+)\/databases\/\(default\)\/documents(.*)$/.exec(url);
  if (!m) throw new Error('unexpected fetch ' + url);
  const [, pid, rest] = m, S = store[pid];
  if (rest.startsWith(':runQuery')) {
    const q = body.structuredQuery, f = q.where.compositeFilter ? q.where.compositeFilter.filters : [q.where];
    const out = Object.keys(S).filter(p => p.split('/').length === 2 && p.split('/')[0] === q.from[0].collectionId).filter(p => f.every(({ fieldFilter: x }) => {
      const have = S[p][x.field.fieldPath];
      if (x.op === 'EQUAL') return have === dec(x.value);
      return x.value.arrayValue.values.map(dec).includes(have);
    })).map(p => ({ document: docOf(pid, p) }));
    reads.push(...out.map(o => o.document.name)); return json(out);
  }
  if (rest.startsWith(':batchGet')) return json(body.documents.map(d => { const p = d.split('/documents/')[1]; reads.push(p); return S[p] ? { found: docOf(pid, p) } : { missing: d }; }));
  const path = decodeURIComponent(rest.replace(/^\//, '').split('?')[0]);
  if (init.method === 'PATCH') { S[path] = { ...(S[path] || {}), ...Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, dec(v)])) }; return json({}); }
  if (init.method === 'DELETE') { delete S[path]; return json({}); }
  const parts = path.split('/');
  if (parts.length % 2 === 1) { const docs = Object.keys(S).filter(p => p.startsWith(path + '/') && p.split('/').length === parts.length + 1).map(p => docOf(pid, p)); return json({ documents: docs }); }
  return S[path] ? json(docOf(pid, path)) : json({}, 404);
};

const { default: portal } = await import('../api/portal.js');
const { default: register } = await import('../api/register.js');

const call = async (token, action, extra = {}, method = 'POST') => {
  let status = 0, data;
  await portal({ method, headers: { authorization: `Bearer ${token}` }, body: { action, ...extra } }, { status(c) { status = c; return this; }, json(d) { data = d; } });
  return { status, data };
};
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

beforeEach(() => {
  reads.length = 0;
  Object.assign(users, { 'tok-A': { localId: 'uA', email: 'Owner.A@example.com', emailVerified: true }, 'tok-A2': { localId: 'uA2', email: 'co.a@example.com', emailVerified: true },
    'tok-B': { localId: 'uB', email: 'owner.b@example.com', emailVerified: true }, 'tok-U': { localId: 'uU', email: 'owner.a@example.com', emailVerified: false },
    'tok-X': { localId: 'uX', email: 'stranger@example.com', emailVerified: true } });
  const P = store['pms-test'];
  for (const k of Object.keys(P)) delete P[k];
  store['portal-test'] = {};
  Object.assign(P, {
    'owners/oA': { active: true }, 'owners/oB': { active: true }, 'owners/oC': { active: false },
    'owners/oA/private/contact': { fullName: 'Owner A', email: 'owner.a@example.com', coOwners: [{ fullName: 'Co A', email: 'co.a@example.com' }] },
    'owners/oB/private/contact': { fullName: 'Owner B', email: 'owner.b@example.com' },
    'owners/oC/private/contact': { fullName: 'Off', email: 'stranger@example.com' },
    'properties/p1': { name: 'Test Tower', info: { address: '1 Test Road', city: 'KL', ezeeAccount: 'SECRET' } },
    'units/uA1': { ownerId: 'oA', propertyId: 'p1', unitCode: 'T-01', active: true, info: { bedrooms: 2, jmb: 'private-ish' } },
    'units/uB1': { ownerId: 'oB', propertyId: 'p1', unitCode: 'T-02', active: true, info: {} },
    'units/uA1/ownership/x1': { ownerId: 'oA', from: '2026-03-01' },
    'offlineBookings/b1': { unitId: 'uA1', arrival: day(10), departure: day(40), nights: 30, status: 'confirmed', ezeeReservationNo: 'R1' },
    'offlineBookings/b2': { unitId: 'uB1', arrival: day(10), departure: day(12), status: 'confirmed' },
    'offlineBookings/b3': { unitId: 'uA1', arrival: day(5), departure: day(7), status: 'cancelled' },
    'bookings/R1': { unitId: 'uA1', reservationNo: 'R1', arrival: day(10), departure: day(40), status: 'active', departureMonth: day(40).slice(0, 7) },
    'bookings/R2': { unitId: 'uA1', reservationNo: 'R2', arrival: day(-20), departure: day(-18), nights: 2, status: 'active', departureMonth: day(-18).slice(0, 7), guestName: 'NO' },
    'bookings/R3': { unitId: 'uA1', reservationNo: 'R3', arrival: '2026-01-05', departure: '2026-01-07', status: 'active', departureMonth: '2026-01' },
    'bookings/R4': { unitId: 'uB1', reservationNo: 'R4', arrival: day(-3), departure: day(-1), status: 'active', departureMonth: day(-1).slice(0, 7) },
    'statements/uA1_2026-09': { unitId: 'uA1', unitCode: 'T-01', month: '2026-09', status: 'completed', paymentStatus: 'paid', paidAmount: 100, paidDate: '2026-10-05', paidRef: 'REF1', arrangementLabel: 'Profit share', rates: { serviceFeePct: 0.4 }, totals: { payout: 100 }, lines: [{ source: 'Airbnb', arrival: '2026-09-01', departure: '2026-09-03', nights: 2, pto: 100 }] },
    'statements/uA1_2026-10': { unitId: 'uA1', unitCode: 'T-01', month: '2026-10', status: 'completed', paymentStatus: 'pending', totals: { payout: 50 } },
    'statements/uA1_2026-01': { unitId: 'uA1', unitCode: 'T-01', month: '2026-01', status: 'completed', paymentStatus: 'paid', paidAmount: 9, totals: { payout: 9 } },
    'statements/uB1_2026-09': { unitId: 'uB1', unitCode: 'T-02', month: '2026-09', status: 'completed', paymentStatus: 'paid', paidAmount: 77, totals: { payout: 77 } },
    'issues/i1': { type: 'customer', unitId: 'uA1', title: 'Leaking tap', status: 'progress', reportDate: '2026-11-02', driveFolderId: 'F1' },
    'issues/i2': { type: 'customer', unitId: 'uA1', title: 'Hidden job', status: 'open', reportDate: '2026-11-03', hideFromOwner: true },
    'issues/i3': { type: 'customer', unitId: 'uB1', title: 'Other owner job', status: 'open', reportDate: '2026-11-03' },
    'issues/i4': { type: 'inhouse', unitId: 'uA1', title: 'Internal', status: 'open' }
  });
});

describe('who may use the portal', () => {
  it('refuses a login with no token or a bad token', async () => { expect((await call('', 'overview')).status).toBe(401); expect((await call('nope', 'overview')).status).toBe(401); });
  it('refuses an unverified email', async () => { const r = await call('tok-U', 'overview'); expect(r.status).toBe(403); expect(r.data.error).toMatch(/verify/i); });
  it('refuses an email that is not an owner', async () => { expect((await call('tok-X', 'overview')).status).toBe(403); });
  it('refuses a switched-off owner', async () => { expect((await call('tok-X', 'overview')).data.error).toMatch(/not registered/); });
  it('matches the email in any capitals and finds a co-owner by their own email', async () => {
    expect((await call('tok-A', 'overview')).data.profile).toEqual({ name: 'Owner A', email: 'owner.a@example.com' });
    const co = await call('tok-A2', 'overview'); expect(co.data.profile.name).toBe('Co A'); expect(co.data.units.map(u => u.code)).toEqual(['T-01']);
  });
});

describe('an owner sees only their own data', () => {
  it('units: own units only, no private property fields', async () => {
    const r = (await call('tok-A', 'overview')).data;
    expect(r.units).toHaveLength(1); expect(r.units[0]).toMatchObject({ code: 'T-01', property: 'Test Tower', arrangement: 'Profit share', feePct: 0.4, owner_since: '2026-03-01' });
    expect(JSON.stringify(r)).not.toMatch(/SECRET|private-ish|T-02|Owner B/);
  });
  it('stays: dates and nights only, no cancelled, no duplicates of an eZee-keyed booking, nothing before ownership, nothing of others', async () => {
    const s = (await call('tok-A', 'stays')).data.stays;
    expect(s.map(x => x.arrival)).toEqual([day(10), day(-20)]);   // R1 is the eZee copy of offline b1: shown once
    expect(Object.keys(s[0]).sort()).toEqual(['arrival', 'departure', 'nights', 'property', 'source', 'unit']);
    expect(JSON.stringify(s)).not.toMatch(/guestName|NO|T-02/);
  });
  it('payments: paid only, from ownership start, own units only', async () => {
    const p = (await call('tok-A', 'payments')).data.payments;
    expect(p.map(x => x.id)).toEqual(['uA1_2026-09']); expect(p[0]).toMatchObject({ amount: 100, ref: 'REF1', paidDate: '2026-10-05' });
  });
  it('statement data: only a paid statement of their own', async () => {
    const ok = await call('tok-A', 'statement', { id: 'uA1_2026-09' }); expect(ok.status).toBe(200); expect(ok.data.pdf.lines[0].amount).toBe(100);
    for (const id of ['uA1_2026-10', 'uB1_2026-09', 'uA1_2026-01', 'nope']) expect((await call('tok-A', 'statement', { id })).status).toBe(404);
  });
  it('terms: not agreed at first, then recorded and shown', async () => {
    const first = (await call('tok-A', 'terms')).data.terms;
    expect(first.accepted).toBe(false);
    const done = (await call('tok-A', 'acceptTerms')).data.terms;
    expect(done.accepted).toBe(true); expect(done.acceptedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect((await call('tok-A', 'terms')).data.terms.accepted).toBe(true);
    expect((await call('tok-B', 'terms')).data.terms.accepted).toBe(false);   // another owner is asked separately
  });
  it('tickets: status only, not hidden ones, not other units, not in-house', async () => {
    const t = (await call('tok-A', 'tickets')).data.tickets;
    expect(t.map(x => x.id)).toEqual(['i1']); expect(t[0]).toMatchObject({ status: 'In progress', title: 'Leaking tap' });
    expect(Object.keys(t[0]).sort()).toEqual(['date', 'hasFiles', 'id', 'property', 'status', 'title', 'unit']);
  });
  it('ticket files: refused for a hidden ticket or another owner\'s ticket', async () => {
    for (const id of ['i2', 'i3', 'i4', 'zzz']) expect((await call('tok-A', 'ticketFiles', { id })).status).toBe(404);
  });
  it('the other owner gets their own data and nothing of A', async () => {
    const b = await call('tok-B', 'payments'); expect(b.data.payments.map(x => x.id)).toEqual(['uB1_2026-09']);
    expect((await call('tok-B', 'statement', { id: 'uA1_2026-09' })).status).toBe(404);
    expect((await call('tok-B', 'tickets')).data.tickets.map(x => x.id)).toEqual(['i3']);
  });
  it('one unit page: only that unit, and never a unit of another owner', async () => {
    expect((await call('tok-A', 'stays', { unitId: 'uA1' })).data.stays.every(x => x.unit === 'T-01')).toBe(true);
    expect((await call('tok-A', 'payments', { unitId: 'uA1' })).data.payments.map(x => x.id)).toEqual(['uA1_2026-09']);
    expect((await call('tok-A', 'tickets', { unitId: 'uA1' })).data.tickets.map(x => x.id)).toEqual(['i1']);
    for (const a of ['stays', 'payments', 'tickets']) expect((await call('tok-A', a, { unitId: 'uB1' })).status).toBe(404);
  });
  it('unknown actions and wrong methods are refused', async () => { expect((await call('tok-A', 'dump')).status).toBe(400); expect((await call('tok-A', 'overview', {}, 'GET')).status).toBe(405); });
  it('overview says whether each unit is occupied today', async () => {
    store['pms-test']['offlineBookings/b9'] = { unitId: 'uA1', arrival: day(-1), departure: day(2), nights: 3, status: 'confirmed' };
    const real = Date.now, later = real() + 120000;   // past the 30 second server memory
    vi.spyOn(Date, 'now').mockImplementation(() => later);
    try { expect((await call('tok-A', 'overview')).data.units[0].occupied).toBe(true); } finally { vi.restoreAllMocks(); }
  });
});

describe('register', () => {
  const reg = async body => { let status = 0, data; await register({ method: 'POST', headers: {}, body }, { status(c) { status = c; return this; }, json(d) { data = d; } }); return { status, data }; };
  it('creates an account only for a PMS owner email (or co-owner)', async () => {
    expect((await reg({ email: 'Owner.A@example.com', password: 'Longenough1!' })).status).toBe(200);
    expect((await reg({ email: 'co.a@example.com', password: 'Longenough1!' })).status).toBe(200);
    expect((await reg({ email: 'stranger@example.com', password: 'Longenough1!' })).status).toBe(403);   // owner switched off
    expect((await reg({ email: 'nobody@example.com', password: 'Longenough1!' })).status).toBe(403);
  });
  it('checks the email and password shape; an existing account is told to sign in', async () => {
    expect((await reg({ email: 'bad', password: 'Longenough1!' })).status).toBe(400);
    expect((await reg({ email: 'owner.b@example.com', password: 'short' })).status).toBe(400);
    for (const weak of ['longenough1!', 'LONGENOUGH1!', 'Longenough!!', 'Longenough11']) expect((await reg({ email: 'owner.b@example.com', password: weak })).status).toBe(400);
    expect((await reg({ email: 'owner.b@example.com', password: 'Longenough1!' })).status).toBe(200);
    expect((await reg({ email: 'owner.b@example.com', password: 'Longenough1!' })).status).toBe(409);
  });
});
