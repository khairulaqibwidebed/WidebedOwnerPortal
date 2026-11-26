// GET /api/file?k=slip|ticket&id=<statement or ticket id>&f=<Drive file id>&t=<portal ID token>
// Streams ONE photo, video or pay slip to the signed-in owner, after checking that the file sits in the Drive folder of
// a paid statement / visible ticket of THIS owner's units. Supports Range requests so videos play on phones.
// (The token travels in the address because <img>, <video> and downloads cannot send headers; it is a short-lived
// Firebase ID token and the address is only ever used on this site.)
import { HttpError, caller, ownerOf, driveToken, fileMeta, payslipFolder, dg, DRIVE_API, fail } from './_lib.js';
import { load, ticketOf, statementOf } from './_data.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'GET only.');
    const u = new URL(req.url, 'http://x');
    const kind = u.searchParams.get('k'), id = u.searchParams.get('id') || '', f = u.searchParams.get('f') || '';
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(f)) throw new HttpError(400, 'Bad request.');
    const user = await caller(req, u.searchParams.get('t') || '');
    const owner = await ownerOf(user);
    const { rows } = await load(owner);
    const tok = await driveToken();
    let folder = '';
    if (kind === 'ticket') folder = (await ticketOf(rows, id)).driveFolderId || '';
    else if (kind === 'slip') { const { s } = await statementOf(rows, id); folder = (await payslipFolder(tok, s.id, s.unitCode, s.month)) || ''; }
    else throw new HttpError(400, 'Bad request.');
    const meta = await fileMeta(tok, f);
    if (!folder || !(meta.parents || []).includes(folder)) throw new HttpError(404, 'Not found.');
    if (kind === 'ticket' && !/^(image|video)\//.test(meta.mimeType)) throw new HttpError(404, 'Not found.');
    const r = await dg(`${DRIVE_API}/files/${f}?alt=media&supportsAllDrives=true`, tok, { headers: { 'Accept-Encoding': 'identity', ...(req.headers.range ? { Range: req.headers.range } : {}) } });
    res.status(r.status);
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Accept-Ranges', 'bytes');
    for (const h of ['content-length', 'content-range']) if (r.headers.get(h)) res.setHeader(h, r.headers.get(h));
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) { if (!res.headersSent) fail(res, e); else res.end(); }
}
