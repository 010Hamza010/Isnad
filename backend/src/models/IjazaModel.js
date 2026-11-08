const db = require('../../config/db');
const { newToken, newShortCode } = require('../utils/codes');

// every column except the (large) frozen document, plus archive / correction info
const COLUMNS = `i.id, i.user_id, i.student_name, i.module, i.style, i.matn_id, i.qiraa_id, i.riwaya_id, i.tariq_id,
  i.transmission_type_id, i.title, i.body, i.details, i.issued_at, i.issued_hijri, i.place, i.created_at,
  i.public_token, i.short_code, i.revoked_at, i.revoke_reason, i.scan_count, i.last_scanned_at,
  i.content_hash, i.frozen_at, i.replaces_id`;

const SELECT = `
  SELECT ${COLUMNS}, m.title AS matn_title, q.name_ar AS qiraa_name, r.name_ar AS riwaya_name,
         t.name_ar AS tariq_name, tt.name_ar AS tx_name,
         f.sha256 AS pdf_sha256, f.size AS pdf_size, f.filename AS pdf_filename, f.uploaded_at AS pdf_uploaded_at,
         old.short_code AS replaces_code, old.public_token AS replaces_token,
         (SELECT n.short_code FROM ijazat n WHERE n.replaces_id = i.id ORDER BY n.id LIMIT 1) AS replaced_by_code,
         (SELECT n.public_token FROM ijazat n WHERE n.replaces_id = i.id ORDER BY n.id LIMIT 1) AS replaced_by_token
  FROM ijazat i
  LEFT JOIN ijaza_files f ON f.ijaza_id = i.id AND f.kind = 'pdf'
  LEFT JOIN ijazat old ON old.id = i.replaces_id
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

/**
 * Insert an ijaza. With f.replaces_id (a correction), the replaced ijaza is revoked in the same
 * transaction with a reason pointing to the new one.
 */
exports.create = async (userId, f) => {
  const conn = await db.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO ijazat (user_id, student_name, module, style, matn_id, qiraa_id, riwaya_id, tariq_id,
         transmission_type_id, title, body, details, issued_at, issued_hijri, place, replaces_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, f.student_name, f.module, f.style, f.matn_id || null, f.qiraa_id || null, f.riwaya_id || null, f.tariq_id || null,
       f.transmission_type_id || null, f.title || null, f.body, f.details, f.issued_at, f.issued_hijri || null, f.place || null,
       f.replaces_id || null]
    );
    id = r.insertId;
    if (f.replaces_id) {
      await conn.query('UPDATE ijazat SET revoked_at = COALESCE(revoked_at, NOW()), revoke_reason = ? WHERE id = ? AND user_id = ?',
        [f.replaces_reason || null, f.replaces_id, userId]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
  const row = await exports.findById(id, userId);
  if (f.replaces_id) {
    // now that the new code exists, say so on the replaced one
    const reason = [`صدرت بدلها إجازة ${row.short_code}`, f.replaces_reason].filter(Boolean).join(' — ');
    await db.query('UPDATE ijazat SET revoke_reason = ? WHERE id = ? AND user_id = ?', [reason.slice(0, 255), f.replaces_id, userId]);
  }
  return row;
};

/* ── Archive: the exact issued document (frozen once) and the delivered PDF ── */

/** Store the rendered document once; false if it was already frozen (or not this user's). */
exports.freeze = async (id, userId, html, hash) => {
  const [r] = await db.query(
    'UPDATE ijazat SET frozen_html = ?, content_hash = ?, frozen_at = NOW() WHERE id = ? AND user_id = ? AND frozen_html IS NULL',
    [html, hash, id, userId]);
  return r.affectedRows === 1;
};

exports.documentById = async (id, userId) => {
  const [[row]] = await db.query('SELECT frozen_html AS html, content_hash AS hash, frozen_at FROM ijazat WHERE id = ? AND user_id = ?', [id, userId]);
  return row;
};
exports.documentByToken = async (token) => {
  const [[row]] = await db.query('SELECT frozen_html AS html, content_hash AS hash, frozen_at FROM ijazat WHERE public_token = ?', [token]);
  return row;
};

/** Attach the delivered PDF once; false if one is already attached. */
exports.savePdf = async (id, { filename, size, sha256, data }) => {
  try {
    await db.query('INSERT INTO ijaza_files (ijaza_id, kind, filename, size, sha256, data) VALUES (?,?,?,?,?,?)',
      [id, 'pdf', filename, size, sha256, data]);
    return true;
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') return false; throw e; }
};
exports.pdfById = async (id, userId) => {
  const [[row]] = await db.query(
    `SELECT f.filename, f.size, f.sha256, f.data FROM ijaza_files f JOIN ijazat i ON i.id = f.ijaza_id
     WHERE f.ijaza_id = ? AND f.kind = 'pdf' AND i.user_id = ?`, [id, userId]);
  return row;
};
exports.pdfByToken = async (token) => {
  const [[row]] = await db.query(
    `SELECT f.filename, f.size, f.sha256, f.data FROM ijaza_files f JOIN ijazat i ON i.id = f.ijaza_id
     WHERE i.public_token = ? AND f.kind = 'pdf'`, [token]);
  return row;
};

// Issued ijazat are never deleted (see the controller): revoke or correct instead.
