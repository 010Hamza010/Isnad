// Verification of a scanned ijaza QR, from the dashboard (login required).
const Ijaza = require('../models/IjazaModel');
const { HttpError } = require('../utils/httpError');
const { normalizeShortCode } = require('../utils/codes');
const { parsePayload, signatureOk, fieldsOf, FIELDS, LABELS } = require('../utils/qrPayload');

/**
 * body: { payload } (the QR text) or { code } (typed short code).
 * status: valid | revoked | altered (signature or data differ from the record) | unknown | invalid
 */
exports.verify = async (req, res) => {
  const { payload, code } = req.body || {};
  const scanned = payload ? parsePayload(payload) : null;
  if (payload && !scanned) return res.json({ status: 'invalid', message: 'هذا الرمز ليس رمز إجازة من إسناد' });

  const shortCode = normalizeShortCode(scanned ? scanned.code : code);
  if (!shortCode) throw new HttpError(400, 'رمز غير صالح — الصيغة: ISN-XXXX-XXXX');

  const row = await Ijaza.findByShortCode(shortCode, req.user.id);
  if (!row) return res.json({ status: 'unknown', code: shortCode, message: 'لا توجد في سجلك إجازة بهذا الرمز' });

  // compare every field of the QR with the stored ijaza
  const stored = fieldsOf(row);
  const checks = scanned ? [
    ...FIELDS.map(k => ({ field: LABELS[k], ok: scanned[k] === stored[k], scanned: scanned[k] ?? '', stored: stored[k] })),
    { field: LABELS.sig, ok: signatureOk(scanned), scanned: scanned.sig, stored: '' },
  ] : [];
  const altered = checks.some(c => !c.ok);

  await Ijaza.recordScan(row.id);
  res.json({
    status: altered ? 'altered' : row.revoked_at ? 'revoked' : 'valid',
    checks,
    ijaza: {
      id: row.id, short_code: row.short_code, student_name: row.student_name, title: row.title,
      issued_at: row.issued_at, issued_hijri: row.issued_hijri, created_at: row.created_at, place: row.place,
      revoked_at: row.revoked_at, revoke_reason: row.revoke_reason, content_hash: row.content_hash,
      pdf_sha256: row.pdf_sha256, replaced_by_code: row.replaced_by_code, replaces_code: row.replaces_code,
      scan_count: (row.scan_count || 0) + 1,
    },
  });
};
