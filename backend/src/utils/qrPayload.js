/**
 * What the ijaza's QR code contains — five short lines (any phone shows them), kept small so the
 * code stays easy to scan (~130 bytes):
 *
 *   ISN-7K3Q-9P2M          code
 *   أحمد بن علي            student
 *   متن «الآجرومية»        subject (the title without «إجازة في»)
 *   2026-11-08 10:32       issue date-time (UTC)
 *   3fK9aB2cD4eF6gH7       signature: HMAC-SHA256 of the four lines, 96 bits
 *
 * Codes printed with the first, labelled format («الرمز: …») are still read.
 *
 * The signature uses QR_SECRET (or JWT_SECRET when unset): a QR with edited or invented data fails,
 * even before it is compared with the stored ijaza.
 */
const crypto = require('crypto');

const LABELS = { code: 'الرمز', student: 'المجاز', subject: 'الموضوع', issued: 'التاريخ', sig: 'التوقيع' };
const FIELDS = ['code', 'student', 'subject', 'issued'];

const secret = () => {
  const s = process.env.QR_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('QR_SECRET / JWT_SECRET is not set'); // an empty key would let anyone sign
  return s;
};
// one line: a title written on several lines («إجازة في متن ⏎ «…»») signs as «إجازة في متن «…»»
const clean = v => String(v ?? '').replace(/[ \t]*[\r\n]+[ \t]*/g, ' ').trim();

/** «2026-11-08 10:32» (UTC) from a Date or SQL timestamp. */
function issuedStamp(row) {
  const d = new Date(row.created_at || row.issued_at);
  if (Number.isNaN(d.getTime())) return clean(row.issued_at);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

const subjectOf = title => clean(title).replace(/^إجازة في\s+/, '');

const fieldsOf = row => ({
  code: clean(row.short_code), student: clean(row.student_name), subject: subjectOf(row.title), issued: issuedStamp(row),
});

const hmac = msg => crypto.createHmac('sha256', secret()).update(msg).digest('base64url');
const sign = fields => hmac(FIELDS.map(k => fields[k]).join('\n')).slice(0, 16);

/** The text encoded in the QR of a stored ijaza. */
function buildPayload(row) {
  const f = fieldsOf(row);
  return [...FIELDS.map(k => f[k]), sign(f)].join('\n');
}

const CODE_LINE = /^ISN-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

/** Read a scanned/pasted payload back into fields; null if it is not an isnad ijaza QR. */
function parsePayload(text) {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // compact format: five lines starting with the code
  if (lines.length === 5 && CODE_LINE.test(lines[0])) {
    const [code, student, subject, issued, sig] = lines;
    return { code, student, subject, issued, sig, format: 2 };
  }
  // first format: labelled lines
  const out = {};
  lines.forEach(line => {
    const m = line.match(/^([^:]+?)\s*:\s*(.*)$/);
    if (!m) return;
    const key = Object.keys(LABELS).find(k => LABELS[k] === m[1].trim());
    if (key) out[key] = m[2].trim();
  });
  return out.code && out.sig ? { ...out, format: 1 } : null;
}

// the first format signed the full title with a 22-character signature
const expectedSig = f => (f.format === 1
  ? hmac(FIELDS.map(k => f[k]).join('\n')).slice(0, 22)
  : sign(f));

/** The stored ijaza's fields as they appear in a QR of the same format. */
const fieldsForFormat = (row, format) => (format === 1 ? { ...fieldsOf(row), subject: clean(row.title) } : fieldsOf(row));

const signatureOk = fields => {
  const expected = Buffer.from(expectedSig(fields));
  const got = Buffer.from(String(fields.sig || ''));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
};

module.exports = { buildPayload, parsePayload, signatureOk, fieldsOf, fieldsForFormat, FIELDS, LABELS };
