// POST /api/portal   Authorization: Bearer <portal ID token>   body { action, ... }
//   overview                -> { profile, units }                     properties and units of this owner (read only)
//   stays                   -> { stays }                              check-ins and check-outs (dates, nights and the gross rental of the stay: no guest names)
//   bookingRequests         -> { requests }                           this owner's own booking requests (waiting, confirmed, declined)
//   requestBooking { unitId, arrival, departure, note } -> { request }  asks staff to book the owner's own unit (the ONLY thing the portal writes to the PMS;
//                                                                       ownerBookingRequests/{id}, status pending, staff Confirm or Decline in Portfolio > Bookings)
//   cancelBookingRequest { id } -> { ok }                              the owner withdraws a request that is still waiting
//   payments                -> { payments }                           PAID owner statements only
//   statement { id }        -> { pdf }                                what the browser needs to draw the Owner Statement PDF
//   slips { id }            -> { files }                              pay slip files of one paid statement
//   tickets                 -> { tickets }                            maintenance tickets of the owner's units: status only
//   ticket { id }           -> { ticket }                             one visible ticket (status only)
//   ticketFiles { id }      -> { files }                              photos and videos of one ticket
// Everything is read from the PMS with the server's own key and cut down to this owner's units. Nothing is written to the PMS.
import { randomUUID } from 'node:crypto';
import { HttpError, caller, ownerOf, pms, portal, setDoc, query, getDoc, driveToken, listFolder, payslipFolder, lower, myDay, monthsBack, send, fail } from './_lib.js';
import { load, day, nightsOf, fileLines, ticketOf, statementOf } from './_data.js';

// Terms of Use / Privacy Notice: bump this date when the text changes so everyone is asked to agree again (KEEP IN STEP with src/lib/legal.js)
const TERMS_VERSION = '2026-11-27-v1';
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o?.[k] != null && o[k] !== '').map(k => [k, o[k]]));

const staysCache = new Map();
async function staysCached(key, rows) {
  const hit = staysCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.v;
  const v = await stays(rows); staysCache.set(key, { at: Date.now(), v }); return v;
}
// 27 Nov 2026: gross rental of one stay = the room rental the guest was charged for the stay, BEFORE OTA commission, fees and SST.
//  eZee booking: 'All Room Charges (Exclusive of Tax)' (allRoomCharges, with any saved edit winning). Cleaning, deposit and other charges are not in it.
//  Widebed (offline) booking: short stay = rental (total for the stay); long stay (30+ nights) = monthlyRent, shown per month.
// Only this one number leaves the server (no guest name, no fees); the rows are already cut down to this owner's units.
const money = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
function grossOf(b, src) {
  if (src === 'eZee') { const v = money({ ...b, ...(b.edits || {}) }.allRoomCharges); return v == null ? {} : { grossRental: v, grossPer: 'stay' }; }
  const long = b.longTerm === true || nightsOf(b.arrival, b.departure, b.nights) >= 30;
  const v = money(long ? (b.monthlyRent || b.rental) : b.rental);
  return v == null ? {} : { grossRental: v, grossPer: long ? 'month' : 'stay' };
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
      out.push({ unit: r.code, property: r.property, arrival: String(b.arrival).slice(0, 10), departure: String(b.departure).slice(0, 10), nights: nightsOf(b.arrival, b.departure, b.nights), source: src, ...grossOf(b, src) });
    };
    off.forEach(b => add(b, 'Widebed')); ez.filter(b => !have.has(String(b.reservationNo || b.id))).forEach(b => add(b, 'eZee'));
  }));
  return out.sort((a, b) => b.arrival.localeCompare(a.arrival));
}

// ---------- Owner booking requests (27 Nov 2026) ----------
const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const requestOf = r => ({ id: r.id, unit: r.unitCode, unitId: r.unitId, property: r.property, arrival: r.arrival, departure: r.departure, nights: r.nights,
  note: r.note || '', status: r.status, declineReason: r.status === 'declined' ? r.declineReason || '' : '', created: String(r.createdAt || '').slice(0, 10) });
async function myRequests(owner, rows) {
  const ids = new Set(rows.map(r => r.id));
  const list = await query(pms(), 'ownerBookingRequests', [['ownerId', 'EQUAL', owner.ownerId]], 300);
  return list.filter(r => ids.has(r.unitId) && r.status !== 'cancelled').map(requestOf)
    .sort((a, b) => b.arrival.localeCompare(a.arrival));
}
// The owner asks staff to book their own unit. Staff see it in the PMS (Portfolio > Bookings, Owner requests) and a notification goes to Directors and Operations.
async function requestBooking(owner, user, row, b) {
  const arrival = String(b.arrival || ''), departure = String(b.departure || '');
  if (!isDay(arrival) || !isDay(departure)) throw new HttpError(400, 'Please pick a check-in and a check-out date.');
  if (arrival < myDay()) throw new HttpError(400, 'The check-in date cannot be in the past.');
  if (departure <= arrival) throw new HttpError(400, 'The check-out date must be after the check-in date.');
  const nights = nightsOf(arrival, departure);
  if (nights > 1000 || arrival > new Date(Date.now() + 5 * 365 * 864e5).toISOString().slice(0, 10)) throw new HttpError(400, 'Those dates look wrong. Please check them.');
  const note = String(b.note || '').trim().slice(0, 300);
  const mine = await myRequests(owner, [row]);
  const clash = (a, d) => arrival < d && departure > a;
  if (mine.some(r => ['pending', 'confirmed'].includes(r.status) && clash(r.arrival, r.departure))) throw new HttpError(400, 'You already have a request for these dates.');
  if ((await staysCached(`${owner.ownerId}:${row.id}`, [row])).some(s => clash(s.arrival, s.departure))) throw new HttpError(400, 'This unit is already booked on some of these dates.');
  const waiting = (await query(pms(), 'ownerBookingRequests', [['ownerId', 'EQUAL', owner.ownerId], ['status', 'EQUAL', 'pending']], 50)).length;
  if (waiting >= 10) throw new HttpError(400, 'You have 10 requests waiting. Please wait for Widebed to answer some of them.');
  const id = 'obr_' + randomUUID().replace(/-/g, '').slice(0, 20), now = new Date();
  const rec = { ownerId: owner.ownerId, ownerName: owner.name || '', ownerEmail: user.email, unitId: row.id, unitCode: row.code, propertyId: row.propertyId || '', property: row.property,
    arrival, departure, nights, note, status: 'pending', category: 'Owner Booking', createdAt: now, createdVia: 'owner-portal' };
  await setDoc(pms(), `ownerBookingRequests/${id}`, rec);
  const message = `${owner.name || 'An owner'} asks to book ${row.code}${row.property ? ' · ' + row.property : ''}, ${arrival} to ${departure} (${nights} ${nights === 1 ? 'night' : 'nights'}). Confirm or decline in Portfolio > Bookings.`;
  await Promise.allSettled(['director', 'operations'].map(role => setDoc(pms(), `notifications/${randomUUID().replace(/-/g, '').slice(0, 20)}`, {
    recipientUid: null, recipientRole: role, title: 'Owner booking request', message: message.slice(0, 600), type: 'ownerBooking', link: '/Portfolio/bookings', refId: id,
    readBy: [], starredBy: [], createdByUid: null, createdByName: 'Owner Portal', createdAt: now })));
  staysCache.clear();
  return requestOf({ id, ...rec });
}
async function cancelRequest(owner, id) {
  const r = await getDoc(pms(), `ownerBookingRequests/${id}`);
  if (!r || r.ownerId !== owner.ownerId) throw new HttpError(404, 'Not found.');
  if (r.status !== 'pending') throw new HttpError(400, 'Only a request that is still waiting can be cancelled.');
  await setDoc(pms(), `ownerBookingRequests/${id}`, { status: 'cancelled', updatedAt: new Date() });
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
      case 'bookingRequests': return send(res, 200, { requests: await myRequests(owner, rows) });
      case 'requestBooking': {
        if (!b.unitId) throw new HttpError(400, 'Please choose a unit.');
        return send(res, 200, { request: await requestBooking(owner, user, rows[0], b) });
      }
      case 'cancelBookingRequest': {
        await cancelRequest(owner, String(b.id || ''));
        return send(res, 200, { ok: true });
      }
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
