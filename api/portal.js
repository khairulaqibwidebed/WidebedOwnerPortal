// POST /api/portal   Authorization: Bearer <portal ID token>   body { action, ... }
//   overview                -> { profile, units }                     properties and units of this owner (read only)
//   stays                   -> { stays }                              check-ins and check-outs (dates and nights only: no guest names, no amounts)
//   payments                -> { payments }                           PAID owner statements only
//   statement { id }        -> { pdf }                                what the browser needs to draw the Owner Statement PDF
//   slips { id }            -> { files }                              pay slip files of one paid statement
//   tickets                 -> { tickets }                            maintenance tickets of the owner's units: status only
//   ticketFiles { id }      -> { files }                              photos and videos of one ticket
// Everything is read from the PMS with the server's own key and cut down to this owner's units. Nothing is written to the PMS.
import { HttpError, caller, ownerOf, pms, query, getDoc, driveToken, listFolder, payslipFolder, lower, myDay, monthsBack, send, fail } from './_lib.js';
import { load, day, nightsOf, fileLines, ticketOf, statementOf } from './_data.js';

const pick = (o, keys) => Object.fromEntries(keys.filter(k => o?.[k] != null && o[k] !== '').map(k => [k, o[k]]));

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
    const { rows } = await load(owner);
    switch (b.action) {
      case 'overview':
        return send(res, 200, { profile: { name: owner.name, email: user.email },
          units: rows.map(r => ({ id: r.id, code: r.code, property: r.property, propertyInfo: pick(r.info, ['address', 'city', 'state']),
            details: pick(r.details, ['type', 'bedrooms', 'bathrooms', 'sizeSqft', 'carParks']), arrangement: r.arrangement, feePct: r.feePct, owner_since: r.from || '' })) });
      case 'stays': return send(res, 200, { today: myDay(), stays: await stays(rows) });
      case 'payments':
        return send(res, 200, { payments: rows.flatMap(r => r.statements.filter(s => s.paymentStatus === 'paid').map(s => ({ id: s.id, unit: r.code, property: r.property, month: s.month,
          amount: s.paidAmount ?? s.totals?.payout ?? 0, paidDate: s.paidDate || '', ref: s.paidRef || '', arrangement: s.arrangementLabel || '', hasPdf: !s.fixed })))
          .sort((a, c) => c.month.localeCompare(a.month) || a.unit.localeCompare(c.unit)) });
      case 'statement': {
        const { s } = await statementOf(rows, String(b.id || ''));
        if (s.fixed) throw new HttpError(404, 'No statement PDF for a fixed rent unit.');
        const rec = await getDoc(pms(), `statements/${s.id}`);
        if (!rec) throw new HttpError(404, 'Not found.');
        const { lines, expenses } = fileLines(rec);
        return send(res, 200, { pdf: { unitCode: rec.unitCode, month: rec.month, rates: pick(rec.rates, ['serviceFeePct', 'utilityFeePct', 'sstOnFeePct']),
          payout: rec.totals?.payout ?? 0, payouts: {}, lines, expenses, nextBooking: null } });
      }
      case 'slips': {
        const { s } = await statementOf(rows, String(b.id || ''));
        const tok = await driveToken(), folder = await payslipFolder(tok, s.id, s.unitCode, s.month);
        const files = folder ? (await listFolder(tok, folder)).filter(f => !f.mimeType.startsWith('application/vnd.google-apps')) : [];
        return send(res, 200, { files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType })) });
      }
      case 'tickets': return send(res, 200, { tickets: await tickets(rows) });
      case 'ticketFiles': {
        const t = await ticketOf(rows, String(b.id || ''));
        if (!t.driveFolderId) return send(res, 200, { files: [] });
        const files = (await listFolder(await driveToken(), t.driveFolderId)).filter(f => /^(image|video)\//.test(f.mimeType));
        return send(res, 200, { files: files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: +f.size || 0 })).reverse() });
      }
      default: throw new HttpError(400, 'Unknown request.');
    }
  } catch (e) { fail(res, e); }
}
