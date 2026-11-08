/**
 * What the ijaza's QR code contains: readable lines (any phone shows them) plus a signature.
 *
 *   إجازة — إسناد
 *   الرمز: ISN-7K3Q-9P2M
 *   المجاز: أحمد بن علي
 *   الموضوع: إجازة في متن «الآجرومية»
 *   التاريخ: 2026-11-08 10:32
 *   التوقيع: 3fK9…   (HMAC-SHA256 of the fields above, 128 bits)
 *
 * The signature uses QR_SECRET (or JWT_SECRET when unset): a QR with edited or invented data fails,
 * even before it is compared with the stored ijaza.
 */
const crypto = require('crypto');

const HEADER = 'إجازة — إسناد';
const LABELS = { code: 'الرمز', student: 'المجاز', subject: 'الموضوع', issued: 'التاريخ', sig: 'التوقيع' };
const FIELDS = ['code', 'student', 'subject', 'issued'];

const secret = () => process.env.QR_SECRET || process.env.JWT_SECRET || '';
const clean = v => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();

/** «2026-11-08 10:32» (UTC) from a Date or SQL timestamp. */
function issuedStamp(row) {
  const d = new Date(row.created_at || row.issued_at);
  if (Number.isNaN(d.getTime())) return clean(row.issued_at);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

const fieldsOf = row => ({
  code: clean(row.short_code), student: clean(row.student_name), subject: clean(row.title), issued: issuedStamp(row),
});

function sign(fields) {
  const msg = FIELDS.map(k => fields[k]).join('\n');
  return crypto.createHmac('sha256', secret()).update(msg).digest('base64url').slice(0, 22);
}

/** The text encoded in the QR of a stored ijaza. */
function buildPayload(row) {
  const f = fieldsOf(row);
  return [HEADER, ...FIELDS.map(k => `${LABELS[k]}: ${f[k]}`), `${LABELS.sig}: ${sign(f)}`].join('\n');
}

/** Read a scanned/pasted payload back into fields; null if it is not an isnad ijaza QR. */
function parsePayload(text) {
  const out = {};
  String(text ?? '').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
    if (!m) return;
    const key = Object.keys(LABELS).find(k => LABELS[k] === m[1].trim());
    if (key) out[key] = m[2].trim();
  });
  return out.code && out.sig ? out : null;
}

const signatureOk = fields => {
  const expected = Buffer.from(sign(fields));
  const got = Buffer.from(String(fields.sig || ''));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
};

module.exports = { buildPayload, parsePayload, signatureOk, fieldsOf, FIELDS, LABELS };
