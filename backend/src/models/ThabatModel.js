const db = require('../../config/db');
const TxType = require('./TxTypeModel');
const { quranSignature } = require('../services/thabat');
const QCM = require('./QuranConnectionModel');
const Quran = require('./QuranModel');

const PERSON = 'id, name_ar, name_latin, kunya, nisba, death_year, century, gender, region, description, uid';

async function quranLinks(userId) {
  const [rows] = await db.query('SELECT * FROM quran_connections WHERE user_id=?', [userId]);
  if (rows.length) {
    const [items] = await db.query('SELECT * FROM quran_connection_items WHERE connection_id IN (?)', [rows.map(r => r.id)]);
    const by = {};
    items.forEach(it => { (by[it.connection_id] ??= []).push(it); });
    rows.forEach(r => { r.items = by[r.id] || []; });
    const [books, groups] = await Promise.all([QCM.booksOf(rows.map(r => r.id)), QCM.groupsOf(rows.map(r => r.id))]);
    rows.forEach(r => { r.books = books[r.id] || []; r.groups = groups[r.id] || []; });
  }
  return rows;
}

exports.lists = async () => {
  const [[mutoon], [qiraat], [riwayat], [turuq], [groups]] = await Promise.all([
    db.query('SELECT * FROM mutoon'), db.query('SELECT * FROM qiraat'), db.query('SELECT * FROM riwayat'), db.query('SELECT * FROM turuq'),
    db.query('SELECT id, name_ar FROM quran_groups'),
  ]);
  return { mutoon, qiraat, riwayat, turuq, groups };
};

/** Everything a thabat can hold (services/thabat picks what goes in). */
exports.exportData = async (userId) => {
  const [[matnConns], quranConns, lists, groups] = await Promise.all([
    db.query('SELECT * FROM matn_connections'), quranLinks(userId), exports.lists(), Quran.allGroups()]);
  await TxType.annotate(matnConns);
  await TxType.annotateQuran(quranConns);
  return { matnConns, quranConns, ...lists, groups };   // groups with their members and books
};

exports.persons = async (ids) => {
  if (ids && !ids.length) return new Map();
  const [rows] = ids ? await db.query(`SELECT ${PERSON} FROM persons WHERE id IN (?)`, [ids]) : await db.query(`SELECT ${PERSON} FROM persons WHERE id > 0`);
  return new Map(rows.map(r => [Number(r.id), r]));
};

/** Connections already here, keyed as services/thabat compares them. */
exports.existing = async (userId) => {
  const [m] = await db.query('SELECT from_person_id f, to_person_id t, matn_id, is_general_ijaza g FROM matn_connections');
  const existingMatn = new Set(m.map(r => `${r.f}:${r.t}:${r.matn_id == null || Number(r.g) ? 'g' : r.matn_id}`));
  const q = await quranLinks(userId);
  const existingQuran = new Set(q.map(r => `${r.from_person_id}:${r.to_person_id}:${quranSignature(r.items.map(it => ({ qiraa: it.qiraa_id, riwaya: it.riwaya_id, tariq: it.tariq_id })), r.groups.map(g => g.group_id))}`));
  return { existingMatn, existingQuran };
};

const FIELDS = ['name_ar', 'name_latin', 'kunya', 'nisba', 'death_year', 'century', 'gender', 'region', 'description', 'uid'];
const FILLABLE = new Set(['description', 'death_year', 'kunya', 'nisba', 'region', 'name_latin', 'century']);

/** Write a plan from services/thabat.planThabat in one transaction. */
exports.apply = async (plan, userId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ids = {};
    const id = v => (typeof v === 'string' && v.startsWith('ref:') ? ids[v] : v);

    for (const p of plan.persons) {
      const cols = FIELDS.filter(k => p[k] != null && p[k] !== '');
      const [r] = await conn.query(`INSERT INTO persons (${cols.join(', ')}) VALUES (?)`, [cols.map(k => p[k])]);
      ids[p.key] = r.insertId;
    }
    for (const f of plan.fills) {
      // only fields still empty: never overwrite what was written here
      for (const [k, v] of Object.entries(f.fields)) {
        if (!FILLABLE.has(k)) continue;
        await conn.query(`UPDATE persons SET ${k}=? WHERE id=? AND (${k} IS NULL OR ${k}='')`, [v, f.id]);
      }
    }
    for (const l of plan.remember)
      await conn.query('INSERT INTO person_links (uid, person_id) VALUES (?,?) ON DUPLICATE KEY UPDATE person_id = VALUES(person_id)', [l.uid, l.person_id]);

    for (const q of plan.qiraat) {
      const [r] = await conn.query('INSERT INTO qiraat (name_ar, imam_id) VALUES (?,?)', [q.name_ar, id(q.imam)]);
      ids[q.key] = r.insertId;
    }
    for (const x of plan.riwayat) {
      const [r] = await conn.query('INSERT INTO riwayat (name_ar, qiraa_id, rawi_id) VALUES (?,?,?)', [x.name_ar, id(x.qiraa), id(x.rawi)]);
      ids[x.key] = r.insertId;
    }
    for (const t of plan.turuq) {
      const [r] = await conn.query('INSERT INTO turuq (name_ar, riwaya_id) VALUES (?,?)', [t.name_ar, id(t.riwaya)]);
      ids[t.key] = r.insertId;
    }
    for (const t of plan.turuq) if (t.parent != null) await conn.query('UPDATE turuq SET parent_id=? WHERE id=?', [id(t.parent), ids[t.key]]);
    for (const m of plan.mutoon) {
      const [r] = await conn.query('INSERT INTO mutoon (title, author_id, subject, description) VALUES (?,?,?,?)', [m.title, id(m.author), m.subject, m.description]);
      ids[m.key] = r.insertId;
    }
    for (const g of plan.groups || []) {
      const [r] = await conn.query('INSERT INTO quran_groups (name_ar, text_ar, description) VALUES (?,?,?)', [g.name_ar, g.text_ar, g.description]);
      ids[g.key] = r.insertId;
      for (const it of g.items) await conn.query('INSERT INTO quran_group_items (group_id, qiraa_id, riwaya_id) VALUES (?,?,?)', [r.insertId, id(it.qiraa), id(it.riwaya)]);
      for (const b of g.books) await conn.query('INSERT IGNORE INTO quran_group_books (group_id, matn_id) VALUES (?,?)', [r.insertId, id(b)]);
    }

    let links = 0;
    for (const l of plan.matnLinks) {
      if (l.exists) continue;
      const matn = id(l.matn);
      await conn.query(
        'INSERT INTO matn_connections (from_person_id, to_person_id, matn_id, transmission_type_id, is_general_ijaza, reading_mode, description) VALUES (?,?,?,?,?,?,?)',
        [id(l.from), id(l.to), matn ?? null, l.transmission_type_id, matn == null ? 1 : 0, l.reading_mode, l.description]);
      links++;
    }
    for (const l of plan.quranLinks) {
      if (l.exists) continue;
      const [r] = await conn.query(
        `INSERT INTO quran_connections (user_id, from_person_id, to_person_id, is_general, transmission_type_id, reading_mode, description, ijaza_date, khatmat_count, meeting_mode)
         VALUES (?,?,?,?,?,?,?,?,?,COALESCE(?, 'حضوراً'))`,
        // «عام» as in the file (v1 files: a link above mine naming nothing, see services/thabat)
        [userId, id(l.from), id(l.to), id(l.from) !== 0 && l.is_general ? 1 : 0, l.transmission_type_id, l.reading_mode, l.description, l.ijaza_date, l.khatmat_count ?? 1, l.meeting_mode]);
      for (const it of l.items)
        await conn.query('INSERT INTO quran_connection_items (connection_id, qiraa_id, riwaya_id, tariq_id) VALUES (?,?,?,?)', [r.insertId, id(it.qiraa), id(it.riwaya), id(it.tariq)]);
      for (const b of l.books || []) await conn.query('INSERT IGNORE INTO quran_connection_books (connection_id, matn_id) VALUES (?,?)', [r.insertId, id(b)]);
      for (const g of l.groups || []) await conn.query('INSERT IGNORE INTO quran_connection_groups (connection_id, group_id) VALUES (?,?)', [r.insertId, id(g)]);
      links++;
    }
    await conn.commit();
    return { persons: plan.persons.length, fills: plan.fills.length, mutoon: plan.mutoon.length, quranNames: plan.qiraat.length + plan.riwayat.length + plan.turuq.length + (plan.groups?.length || 0), links };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};
