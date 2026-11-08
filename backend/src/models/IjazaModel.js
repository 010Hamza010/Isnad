const db = require('../../config/db');
const { newToken, newShortCode } = require('../utils/codes');

const SELECT = `
  SELECT i.*, m.title AS matn_title, q.name_ar AS qiraa_name, r.name_ar AS riwaya_name,
         t.name_ar AS tariq_name, tt.name_ar AS tx_name
  FROM ijazat i
  LEFT JOIN mutoon m  ON m.id = i.matn_id
  LEFT JOIN qiraat q  ON q.id = i.qiraa_id
  LEFT JOIN riwayat r ON r.id = i.riwaya_id
  LEFT JOIN turuq t   ON t.id = i.tariq_id
  LEFT JOIN transmission_types tt ON tt.id = i.transmission_type_id`;

const parseDetails = row => {
  if (!row || typeof row.details !== 'string') return row;
  try { return { ...row, details: JSON.parse(row.details) }; } catch { return { ...row, details: null }; }
};

// Give a row its public token and short code (new rows, and rows issued before verification existed).
// A collision on the unique keys is astronomically unlikely, but is retried.
async function ensureCodes(row) {
  if (!row || (row.public_token && row.short_code)) return row;
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = row.public_token || newToken();
    const code = row.short_code || newShortCode();
    try {
      await db.query('UPDATE ijazat SET public_token = ?, short_code = ? WHERE id = ?', [token, code, row.id]);
      return { ...row, public_token: token, short_code: code };
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
  throw new Error('could not allocate a unique verification code');
}
exports.ensureCodes = ensureCodes;

exports.findAllForUser = async (userId) => {
  const [rows] = await db.query(`${SELECT} WHERE i.user_id = ? ORDER BY i.issued_at DESC, i.id DESC`, [userId]);
  const out = [];
  for (const r of rows) out.push(parseDetails(await ensureCodes(r)));
  return out;
};

exports.findById = async (id, userId) => {
  const [[row]] = await db.query(`${SELECT} WHERE i.id = ? AND i.user_id = ?`, [id, userId]);
  return parseDetails(await ensureCodes(row));
};

/** Public lookups (no user scope): by link token or by the printed short code. */
exports.findByToken = async (token) => {
  const [[row]] = await db.query(`${SELECT} WHERE i.public_token = ?`, [token]);
  return parseDetails(row);
};
exports.findByShortCode = async (code) => {
  const [[row]] = await db.query(`${SELECT} WHERE i.short_code = ?`, [code]);
  return parseDetails(row);
};

exports.recordScan = async (id) => {
  await db.query('UPDATE ijazat SET scan_count = scan_count + 1, last_scanned_at = NOW() WHERE id = ?', [id]);
};

exports.setRevoked = async (id, userId, reason) => {
  await db.query(
    'UPDATE ijazat SET revoked_at = ?, revoke_reason = ? WHERE id = ? AND user_id = ?',
    reason === null ? [null, null, id, userId] : [new Date(), reason || null, id, userId]
  );
};

exports.create = async (userId, f) => {
  const [r] = await db.query(
    `INSERT INTO ijazat (user_id, student_name, module, style, matn_id, qiraa_id, riwaya_id, tariq_id,
       transmission_type_id, title, body, details, issued_at, issued_hijri, place)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [userId, f.student_name, f.module, f.style, f.matn_id || null, f.qiraa_id || null, f.riwaya_id || null, f.tariq_id || null,
     f.transmission_type_id || null, f.title || null, f.body, f.details, f.issued_at, f.issued_hijri || null, f.place || null]
  );
  return exports.findById(r.insertId, userId);
};

exports.remove = async (id, userId) => {
  await db.query('DELETE FROM ijazat WHERE id = ? AND user_id = ?', [id, userId]);
};
