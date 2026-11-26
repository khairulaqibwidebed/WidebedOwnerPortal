// Reading one owner's data from the PMS (read only, server side). Used by api/portal.js and api/file.js.
import { HttpError, pms, query, batchGet, listSub, getDoc } from './_lib.js';

const STATEMENT_FIELDS = ['unitId', 'unitCode', 'month', 'status', 'paymentStatus', 'paidDate', 'paidAmount', 'paidRef', 'arrangementLabel', 'fixed', 'rates', 'totals'];
export const day = v => { const s = String(v || '').slice(0, 10); return s.length === 7 ? s + '-01' : s; };
export const nightsOf = (a, d, n) => Number(n) || (a && d ? Math.max(0, Math.round((Date.parse(d) - Date.parse(a)) / 864e5)) : 0);

// Same as fileLines() in the PMS (lib/summaries.js): the booking and expense lines of the owner's PDF statement. KEEP IN STEP.
export function fileLines(rec) {
  const lines = (rec.lines || []).map(l => ({ source: l.source, arrival: l.arrival, departure: l.departure, nights: l.nights, amount: l.pto }));
  let exps = rec.expenseLines || [];
  const type = rec.rates?.type, pc = x => `${+(Number(x || 0) * 100).toFixed(2)}%`, rm = x => (Number(x) || 0).toFixed(2);
  if (type === 'profit') {
    const before = exps.filter(e => e.kind === 'expense');
    if (before.length) {
      lines.push({ source: 'Unit expenses (before fees)', nights: 0, amount: before.reduce((s, e) => s + (Number(e.amount) || 0), 0) });
      exps = exps.filter(e => e.kind !== 'expense');
    }
  }
  if (type === 'pool' && rec.pool) {
    const own = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), p = rec.pool;
    lines.push({ source: `Pool share: ${pc(p.unitPct)} of Net Rental # RM ${rm(p.netRental)} (${pc(p.netRentalPct)} of pot RM ${rm(p.pot)})`, nights: 0, amount: p.share - own });
  }
  return { lines, expenses: exps.map(e => ({ description: e.description, amount: e.amount })) };
}

// The owner's units with property, the date they became the owner, and their statements (kept 5 minutes per owner)
const cache = new Map();
export async function load(owner) {
  const hit = cache.get(owner.ownerId);
  if (hit && Date.now() - hit.at < 300000) return hit.v;
  const k = pms();
  const units = (await query(k, 'units', [['ownerId', 'EQUAL', owner.ownerId]])).filter(u => u.active !== false && u.unitCode);
  const props = await batchGet(k, [...new Set(units.map(u => u.propertyId).filter(Boolean))].map(id => `properties/${id}`));
  const rows = await Promise.all(units.map(async u => {
    const [own, sts] = await Promise.all([listSub(k, `units/${u.id}/ownership`).catch(() => []),
      query(k, 'statements', [['unitId', 'EQUAL', u.id]], 200, STATEMENT_FIELDS)]);
    const mine = own.filter(o => o.ownerId === owner.ownerId);
    const cur = mine.filter(o => !o.to).sort((a, b) => String(b.from).localeCompare(String(a.from)))[0] || mine.sort((a, b) => String(b.from).localeCompare(String(a.from)))[0];
    const from = day(cur?.from);
    const p = props[`properties/${u.propertyId}`] || {};
    const done = sts.filter(s => s.status === 'completed' && (!from || String(s.month) >= from.slice(0, 7))).sort((a, b) => String(b.month).localeCompare(String(a.month)));
    return { id: u.id, code: u.unitCode, propertyId: u.propertyId || '', property: p.name || '', info: p.info || {}, details: u.info || {}, from, statements: done,
      arrangement: done.find(x => x.arrangementLabel)?.arrangementLabel || '', feePct: done.find(x => x.rates?.serviceFeePct != null)?.rates.serviceFeePct ?? null, fixed: !!done[0]?.fixed };
  }));
  const v = { rows };
  cache.set(owner.ownerId, { at: Date.now(), v });
  return v;
}

// A ticket of one of this owner's units that is not hidden, with its Drive folder (never sent to the browser)
export async function ticketOf(rows, id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id || '')) throw new HttpError(400, 'Bad request.');
  const t = await getDoc(pms(), `issues/${id}`);
  if (!t || t.type !== 'customer' || t.hideFromOwner === true || !rows.some(r => r.id === t.unitId)) throw new HttpError(404, 'Not found.');
  return t;
}
export async function statementOf(rows, id) {
  const r = rows.find(x => x.statements.some(s => s.id === id));
  const s = r?.statements.find(x => x.id === id);
  if (!s || s.paymentStatus !== 'paid') throw new HttpError(404, 'Not found.');   // only PAID statements are shown
  return { r, s };
}

