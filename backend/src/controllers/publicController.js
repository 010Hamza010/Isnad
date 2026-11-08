// Public verification of an issued ijaza (the QR code link). No login; read-only; rate-limited.
const Ijaza    = require('../models/IjazaModel');
const Settings = require('../models/SettingsModel');
const { HttpError } = require('../utils/httpError');
const { normalizeShortCode, isToken } = require('../utils/codes');

/** Only what a verifier needs — never ids, user ids or internal fields. */
async function publicView(row) {
  const people = row.details?.people || {};
  const shaykh = people.shaykh || (await Settings.get(row.user_id, 'ijaza'))?.shaykh_name || null;
  return {
    status: row.revoked_at ? 'revoked' : 'valid',
    revoked_at: row.revoked_at || null,
    revoke_reason: row.revoked_at ? row.revoke_reason || null : null,
    short_code: row.short_code,
    student_name: row.student_name,
    shaykh_name: shaykh,
    title: row.title,
    module: row.module,
    style: row.style,
    issued_at: row.issued_at,
    issued_hijri: row.issued_hijri,
    place: row.place,
    body: row.body,
    details: row.details ? { notes: row.details.notes || {}, chains: row.details.chains || [], design: row.details.design || null, people } : null,
  };
}

async function respond(row, req, res) {
  if (!row) throw new HttpError(404, 'لا توجد إجازة بهذا الرمز');
  if (req.query.preview !== '1') await Ijaza.recordScan(row.id); // the owner's own preview is not a scan
  res.json(await publicView(row));
}

exports.byToken = async (req, res) => {
  if (!isToken(req.params.token)) throw new HttpError(404, 'لا توجد إجازة بهذا الرمز');
  await respond(await Ijaza.findByToken(req.params.token), req, res);
};

exports.byCode = async (req, res) => {
  const code = normalizeShortCode(req.params.code);
  if (!code) throw new HttpError(400, 'رمز غير صالح — الصيغة: ISN-XXXX-XXXX');
  await respond(await Ijaza.findByShortCode(code), req, res);
};

exports.publicView = publicView;
