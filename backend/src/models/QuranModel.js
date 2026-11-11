const db = require('../../config/db');

// ── Qiraat ────────────────────────────────────────────────
exports.allQiraat = async () => {
  const [rows] = await db.execute(
    'SELECT q.*, p.name_ar as imam_name FROM qiraat q LEFT JOIN persons p ON p.id=q.imam_id ORDER BY q.name_ar'
  );
  return rows;
};
exports.createQiraa = async ({ name_ar, imam_id, description }) => {
  const [r] = await db.execute(
    'INSERT INTO qiraat (name_ar,imam_id,description) VALUES (?,?,?)',
    [name_ar, imam_id||null, description||null]
  );
  return { id: r.insertId };
};
exports.updateQiraa = async (id, { name_ar, imam_id, description }) => {
  await db.execute('UPDATE qiraat SET name_ar=?,imam_id=?,description=? WHERE id=?', [name_ar, imam_id||null, description||null, id]);
};
exports.removeQiraa = async (id) => { await db.execute('DELETE FROM qiraat WHERE id=?', [id]); };

// ── Riwayat ───────────────────────────────────────────────
exports.allRiwayat = async () => {
  const [rows] = await db.execute(`
    SELECT rw.*, p.name_ar as rawi_name, q.name_ar as qiraa_name
    FROM riwayat rw
    LEFT JOIN persons p ON p.id=rw.rawi_id
    LEFT JOIN qiraat  q ON q.id=rw.qiraa_id
    ORDER BY q.name_ar, rw.name_ar`);
  return rows;
};
exports.createRiwaya = async ({ name_ar, qiraa_id, rawi_id, description }) => {
  const [r] = await db.execute(
    'INSERT INTO riwayat (name_ar,qiraa_id,rawi_id,description) VALUES (?,?,?,?)',
    [name_ar, qiraa_id, rawi_id||null, description||null]
  );
  return { id: r.insertId };
};
exports.updateRiwaya = async (id, { name_ar, qiraa_id, rawi_id, description }) => {
  await db.execute('UPDATE riwayat SET name_ar=?,qiraa_id=?,rawi_id=?,description=? WHERE id=?', [name_ar, qiraa_id, rawi_id||null, description||null, id]);
};
exports.removeRiwaya = async (id) => { await db.execute('DELETE FROM riwayat WHERE id=?', [id]); };

// ── Turuq ─────────────────────────────────────────────────
exports.allTuruq = async () => {
  const [rows] = await db.execute(`
    SELECT t.*, rw.name_ar as riwaya_name, tp.name_ar as parent_name
    FROM turuq t
    LEFT JOIN riwayat rw ON rw.id=t.riwaya_id
    LEFT JOIN turuq   tp ON tp.id=t.parent_id
    ORDER BY rw.name_ar, t.name_ar`);
  return rows;
};
exports.createTariq = async ({ name_ar, riwaya_id, parent_id, description }) => {
  const [r] = await db.execute(
    'INSERT INTO turuq (name_ar,riwaya_id,parent_id,description) VALUES (?,?,?,?)',
    [name_ar, riwaya_id||null, parent_id||null, description||null]
  );
  return { id: r.insertId };
};
exports.updateTariq = async (id, { name_ar, riwaya_id, parent_id, description }) => {
  await db.execute('UPDATE turuq SET name_ar=?,riwaya_id=?,parent_id=?,description=? WHERE id=?', [name_ar, riwaya_id||null, parent_id||null, description||null, id]);
};
exports.removeTariq = async (id) => { await db.execute('DELETE FROM turuq WHERE id=?', [id]); };

// ── groups («العشر الصغرى», «الحرميان»…: services/quranGroups) ──
exports.allGroups = async () => {
  const [groups] = await db.query('SELECT * FROM quran_groups ORDER BY name_ar');
  if (!groups.length) return [];
  const ids = groups.map(g => g.id);
  const [[items], [books]] = await Promise.all([
    db.query(`SELECT gi.group_id, gi.qiraa_id, gi.riwaya_id, q.name_ar AS qiraa_name, r.name_ar AS riwaya_name
              FROM quran_group_items gi LEFT JOIN qiraat q ON q.id = gi.qiraa_id LEFT JOIN riwayat r ON r.id = gi.riwaya_id
              WHERE gi.group_id IN (?) ORDER BY gi.id`, [ids]),
    db.query(`SELECT gb.group_id, gb.matn_id, m.title FROM quran_group_books gb JOIN mutoon m ON m.id = gb.matn_id
              WHERE gb.group_id IN (?) ORDER BY m.title`, [ids]),
  ]);
  return groups.map(g => ({
    ...g,
    items: items.filter(i => i.group_id === g.id).map(({ group_id, ...i }) => i),
    books: books.filter(b => b.group_id === g.id).map(({ group_id, ...b }) => b),
  }));
};

async function writeGroup(conn, id, { items, books }) {
  await conn.query('DELETE FROM quran_group_items WHERE group_id=?', [id]);
  await conn.query('DELETE FROM quran_group_books WHERE group_id=?', [id]);
  for (const it of items) await conn.query('INSERT INTO quran_group_items (group_id, qiraa_id, riwaya_id) VALUES (?,?,?)', [id, it.qiraa_id, it.riwaya_id]);
  for (const b of books) await conn.query('INSERT INTO quran_group_books (group_id, matn_id) VALUES (?,?)', [id, b]);
}

const inTransaction = async fn => {
  const conn = await db.getConnection();
  try { await conn.beginTransaction(); const out = await fn(conn); await conn.commit(); return out; }
  catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

exports.createGroup = g => inTransaction(async conn => {
  const [r] = await conn.query('INSERT INTO quran_groups (name_ar, text_ar, description) VALUES (?,?,?)', [g.name_ar, g.text_ar, g.description]);
  await writeGroup(conn, r.insertId, g);
  return { id: r.insertId };
});

exports.updateGroup = (id, g) => inTransaction(async conn => {
  await conn.query('UPDATE quran_groups SET name_ar=?, text_ar=?, description=? WHERE id=?', [g.name_ar, g.text_ar, g.description, id]);
  await writeGroup(conn, id, g);
});

exports.removeGroup = async id => { await db.execute('DELETE FROM quran_groups WHERE id=?', [id]); };
