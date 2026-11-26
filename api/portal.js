// POST /api/portal   Authorization: Bearer <portal ID token>   body { action, ... }
//   overview                -> { profile, units }                     properties and units of this owner (read only)
//   stays                   -> { stays }                              check-ins and check-outs (dates and nights only: no guest names, no amounts)
//   payments                -> { payments }                           PAID owner statements only
//   statement { id }        -> { pdf }                                what the browser needs to draw the Owner Statement PDF
//   slips { id }            -> { files }                              pay slip files of one paid statement
//   tickets                 -> { tickets }                            maintenance tickets of the owner's units: status only
//   ticket { id }           -> { ticket }                             one visible ticket (status only)
//   ticketFiles { id }      -> { files }                              photos and videos of one ticket
// Everything is read from the PMS with the server's own key and cut down to this owner's units. Nothing is written to the PMS.
import { HttpError, caller, ownerOf, pms, portal, setDoc, query, getDoc, driveToken, listFolder, payslipFolder, lower, myDay, monthsBack, send, fail } from './_lib.js';
import { load, day, nightsOf, fileLines, ticketOf, statementOf } from './_data.js';

// Terms of Use / Privacy Notice: bump this date when the text changes so everyone is asked to agree again (KEEP IN STEP with src/lib/legal.js)
const TERMS_VERSION = '2026-11-26-v2';
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o?.[k] != null && o[k] !== '').map(k => [k, o[k]]));

const staysCache = new Map();
async function staysCached(key, rows) {
  const hit = staysCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.v;
  const v = await stays(rows); staysCache.set(key, { at: Date.now(), v }); return v;
}
async function stays(rows) {
  const k = pms(), months = monthsBack(14, 3), out = [];
  await Promise.all(rows.map(async r => {
    const [off, ez] = await Promise.all([query(k, 'offlineBookings', [['unitId', 'EQUAL', r.id]], 500),
      query(k, 'bookings', [['unitId', 'EQUAL', r.id], ['departureMonth', 'IN', months]], 500)]);
    const have = new Set(off.map(b => String(b.ezeeReservationNo || '')).filter(Boolean));
    const add = (b, src) => {
      if (lower(b.status) === 'cancelled' || !b.arrival || !b.departure) return;
      if (r.from && b.arrival < r.from) return;
      out.push({ unit: r.code, property: r.property, arrival: String(b.arrival).slice(0, 10), departure: String(b.departure).slice(0, 10), nights: nightsOf(b.arrival, b.departure, b.nights), source: src });
    };
    off.forEach(b => add(b, 'Widebed')); ez.filter(b => !have.has(String(b.reservationNo || b.id))).forEach(b => add(b, 'eZee'));
  }));
  return out.sort((a, b) => b.arrival.localeCompare(a.arrival));
}

const TICKET = { open: 'New', progress: 'In progress', done: 'Completed', cancelled: 'Cancelled' };
async function tickets(rows) {
  const k = pms(), out = [];
  await Promise.all(rows.map(async r => {
    const list = await query(k, 'issues', [['type', 'EQUAL', 'customer'], ['unitId', 'EQUAL', r.id]], 300);
    for (const t of list) {
      if (t.hideFromOwner === true || t.status === 'deleted') continue;
      out.push({ id: t.id, unit: r.code, property: r.property, title: String(t.title || 'Maintenance').slice(0, 120), date: String(t.reportDate || '').slice(0, 10),
        status: TICKET[t.status] || 'In progress', hasFiles: !!t.driveFolderId });
    }
  }));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only.');
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const user = await caller(req);
    const owner = await ownerOf(user);
    if (b.action === 'terms' || b.action === 'acceptTerms') {
      const path = `ownerLinks/${user.uid}`;
      if (b.action === 'acceptTerms') await setDoc(portal(), path, { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() });
      const l = await getDoc(portal(), path);
      return send(res, 200, { terms: { version: TERMS_VERSION, accepted: l?.termsVersion === TERMS_VERSION, acceptedAt: l?.termsAcceptedAt || '' } });
    }
    const { rows: all } = await load(owner);
    // One unit's page: only that unit, and only if it is this owner's
    const rows = b.unitId ? all.filter(r => r.id === String(b.unitId)) : all;
    if (b.unitId && !rows.length) throw new HttpError(404, 'Not found.');
    switch (b.action) {
      case 'overview': {
        // Occupied today? From the same bookings as the Check-ins page (Widebed and eZee); a stay counts from check-in day up to, not including, check-out day
        const today = myDay(), st = await staysCached(`${owner.ownerId}:${rows.map(r => r.id).join(',')}`, rows).catch(() => null);
        const busy = new Set((st || []).filter(s => s.arrival <= today && s.departure > today).map(s => s.unit));
        return send(res, 200, { profile: { name: owner.name, email: user.email },
          units: rows.map(r => ({ id: r.id, code: r.code, property: r.property, propertyInfo: pick(r.info, ['address', 'city', 'state']),
            details: pick(r.details, ['type', 'bedrooms', 'bathrooms', 'sizeSqft', 'carParks']), arrangement: r.arrangement, feePct: r.feePct, owner_since: r.from || '', occupied: st ? busy.has(r.code) : null })) });
      }
      case 'stays': return send(res, 200, { today: myDay(), stays: await staysCached(`${owner.ownerId}:${rows.map(r => r.id).join(',')}`, rows) });
      case 'payments':
        return send(res, 200, { payments: rows.flatMap(r => r.statements.filter(s => s.paymentStatus === 'paid').map(s => ({ id: s.id, unit: r.code, property: r.property, month: s.month,
          amount: s.paidAmount ?? s.totals?.payout ?? 0, paidDate: s.paidDate || '', ref: s.paidRef || '', arrangement: s.arrangementLabel || '', hasPdf: !s.fixed })))
          .sort((a, c) => c.month.localeCompare(a.month) || a.unit.localeCompare(c.unit)) });
      case 'statement': {
        const { s } = await statementOf(all, String(b.id || ''));
        if (s.fixed) throw new HttpError(404, 'No statement PDF for a fixed rent unit.');
        const rec = await getDoc(pms(), `statements/${s.id}`);
        if (!rec) throw new HttpError(404, 'Not found.');
        const { lines, expenses } = fileLines(rec);
        return send(res, 200, { pdf: { unitCode: rec.unitCode, month: rec.month, rates: pick(rec.rates, ['serviceFeePct', 'utilityFeePct', 'sstOnFeePct']),
          payout: rec.totals?.payout ?? 0, payouts: {}, lines, expenses, nextBooking: null } });
      }
      case 'slips': {
        const { s } = await statementOf(all, String(b.id || ''));
        const tok = await driveToken(), folder = await payslipFolder(tok, s.id, s.unitCode, s.month);
        const files = folder ? (await listFolder(tok, folder)).filter(f => !f.mimeType.startsWith('application/vnd.google-apps')) : [];
        return send(res, 200, { files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })) });
      }
      case 'tickets': return send(res, 200, { tickets: await tickets(rows) });
      case 'ticket': {
        const t = await ticketOf(all, String(b.id || '')), r = all.find(x => x.id === t.unitId);
        return send(res, 200, { ticket: { id: t.id, unit: r.code, unitId: r.id, property: r.property, title: String(t.title || 'Maintenance').slice(0, 120), date: String(t.reportDate || '').slice(0, 10),
          status: TICKET[t.status] || 'In progress', hasFiles: !!t.driveFolderId } });
      }
      case 'ticketFiles': {
        const t = await ticketOf(all, String(b.id || ''));
        if (!t.driveFolderId) return send(res, 200, { files: [] });
        const files = (await listFolder(await driveToken(), t.driveFolderId)).filter(f => /^(image|video)\//.test(f.mimeType));
        return send(res, 200, { files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: +f.size || 0, at: f.createdTime || '' })).sort((a, b) => a.at.localeCompare(b.at)) });
      }
      default: throw new HttpError(400, 'Unknown request.');
    }
  } catch (e) { fail(res, e); }
}
