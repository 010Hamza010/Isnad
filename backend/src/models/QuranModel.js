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
