const crypto = require('crypto');
const db = require('../../config/db');

const FIELDS = 'id, name_ar, kunya, nisba, death_year, gender, region, uid';

/** Give these persons a permanent code if they have none; returns Map id → row. */
exports.withUids = async (ids) => {
  const list = [...new Set(ids.map(Number))];
  if (!list.length) return new Map();
  const [missing] = await db.query('SELECT id FROM persons WHERE uid IS NULL AND id IN (?)', [list]);
  for (const { id } of missing) await db.query('UPDATE persons SET uid=? WHERE id=? AND uid IS NULL', [crypto.randomUUID(), id]);
  const [rows] = await db.query(`SELECT ${FIELDS} FROM persons WHERE id IN (?)`, [list]);
  return new Map(rows.map(r => [Number(r.id), r]));
};

/** Every code known here (own persons and remembered ones) → local person id. */
exports.uidMap = async () => {
  const [own] = await db.query('SELECT uid, id FROM persons WHERE uid IS NOT NULL');
  const [linked] = await db.query('SELECT uid, person_id AS id FROM person_links');
  return new Map([...linked, ...own].map(r => [r.uid, Number(r.id)]));
};

exports.persons = async () => {
  const [rows] = await db.query(`SELECT ${FIELDS} FROM persons WHERE id <> 0`);
  return rows;
};

/** Names of a Quran option, written in the shared file. */
exports.quranNames = async ({ qiraa_id, riwaya_id, tariq_id }) => {
  const one = async (sql, id) => (id ? (await db.query(sql, [id]))[0][0]?.name_ar || null : null);
  const [rw] = riwaya_id ? await db.query('SELECT name_ar, qiraa_id FROM riwayat WHERE id=?', [riwaya_id]) : [[]];
  return {
    qiraa: await one('SELECT name_ar FROM qiraat WHERE id=?', qiraa_id || rw[0]?.qiraa_id),
    riwaya: rw[0]?.name_ar || null,
    tariq: await one('SELECT name_ar FROM turuq WHERE id=?', tariq_id),
  };
};

/** Local ids for names written in a shared file (exact names, after normalising on the caller's side). */
exports.lists = async () => {
  const [[mutoon], [qiraat], [riwayat], [turuq]] = await Promise.all([
    db.query('SELECT id, title FROM mutoon'), db.query('SELECT id, name_ar FROM qiraat'),
    db.query('SELECT id, name_ar, qiraa_id FROM riwayat'), db.query('SELECT id, name_ar, riwaya_id FROM turuq'),
  ]);
  return { mutoon, qiraat, riwayat, turuq };
};
