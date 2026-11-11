const db = require('../../config/db');
const TxType = require('./TxTypeModel');

exports.getMatnWithEdges = async (matnId) => {
  const [[matn]] = await db.query(
    `SELECT m.*, p.name_ar as author_name FROM mutoon m LEFT JOIN persons p ON m.author_id = p.id WHERE m.id = ?`,
    [matnId]
  );
  const [edges] = await db.query(
    `SELECT mc.*, tt.name_ar as tx_name FROM matn_connections mc
     LEFT JOIN transmission_types tt ON mc.transmission_type_id = tt.id
     WHERE mc.matn_id = ? OR mc.matn_id IS NULL OR mc.is_general_ijaza = 1`, [matnId] // a general ijaza covers every matn
  );
  return { matn, edges: await TxType.annotate(edges) };
};

/** Every matn connection, to compute the routes of all mutoon at once (see getMatnWithEdges). */
exports.getAllMatnEdges = async () => {
  const [edges] = await db.query(
    `SELECT mc.*, tt.name_ar as tx_name FROM matn_connections mc
     LEFT JOIN transmission_types tt ON mc.transmission_type_id = tt.id`);
  return TxType.annotate(edges);
};

/** Qiraa / riwaya items of my own Quran links (from me, person 0). */
exports.getMyQuranItems = async (userId) => {
  const [rows] = await db.query(
    `SELECT DISTINCT i.qiraa_id, i.riwaya_id, rv.name_ar AS riwaya_name, q.name_ar AS qiraa_name
     FROM quran_connections qc
     JOIN quran_connection_items i ON i.connection_id = qc.id
     LEFT JOIN riwayat rv ON rv.id = i.riwaya_id
     LEFT JOIN qiraat q ON q.id = COALESCE(rv.qiraa_id, i.qiraa_id)
     WHERE qc.user_id = ? AND qc.from_person_id = 0`, [userId]);
  return rows;
};

exports.getQuranEdgesForUser = async (userId) => {
  const [edges] = await db.query(
    `SELECT qc.*, tt.name_ar as tx_name FROM quran_connections qc
     LEFT JOIN transmission_types tt ON qc.transmission_type_id = tt.id
     WHERE qc.user_id = ?`, [userId]
  );
  if (edges.length) {
    const [items] = await db.query(
      'SELECT * FROM quran_connection_items WHERE connection_id IN (?)',
      [edges.map(e => e.id)]
    );
    const iMap = {};
    items.forEach(it => { (iMap[it.connection_id] ??= []).push(it); });
    edges.forEach(e => { e.items = iMap[e.id] || []; });
    const books = await require('./QuranConnectionModel').booksOf(edges.map(e => e.id));
    edges.forEach(e => { e.books = books[e.id] || []; });
  }
  return TxType.annotateQuran(edges);
};

exports.getRiwayaById = async (riwaya_id) => {
  const [[r]] = await db.query(
    `SELECT rv.*, q.name_ar as qiraa_name, q.id as qiraa_id, q.imam_id,
            p.name_ar as imam_name, pw.name_ar as rawi_name
     FROM riwayat rv
     LEFT JOIN qiraat  q  ON rv.qiraa_id = q.id
     LEFT JOIN persons p  ON q.imam_id   = p.id
     LEFT JOIN persons pw ON rv.rawi_id   = pw.id
     WHERE rv.id = ?`, [riwaya_id]
  );
  return r;
};

exports.getQiraaById = async (id) => {
  const [[row]] = await db.query(
    'SELECT q.*, p.name_ar as imam_name FROM qiraat q LEFT JOIN persons p ON p.id=q.imam_id WHERE q.id=?',
    [id]
  );
  return row;
};

exports.getAllPersons = async () => {
  const [persons] = await db.query('SELECT id, name_ar, kunya, nisba, gender, death_year, description, primary_qiraa_id FROM persons');
  return new Map(persons.map(p => [Number(p.id), p]));
};

exports.getImamMap = async () => {
  const [rows] = await db.query('SELECT id, imam_id FROM qiraat WHERE imam_id IS NOT NULL');
  return new Map(rows.map(q => [Number(q.imam_id), Number(q.id)]));
};

exports.getFullGraphData = async (userId, module) => {
  const [persons] = await db.query('SELECT id, name_ar, region FROM persons WHERE id > 0');
  let matnEdges = [], quranEdges = [];
  if (module !== 'quran') {
    const [r] = await db.query(
      `SELECT mc.from_person_id, mc.to_person_id, mc.is_general_ijaza, mc.transmission_type_id, tt.name_ar as tx_name, m.title as matn_title
       FROM matn_connections mc
       LEFT JOIN transmission_types tt ON mc.transmission_type_id = tt.id
       LEFT JOIN mutoon m ON mc.matn_id = m.id
       `
    );
    matnEdges = await TxType.annotate(r);
  }
  if (module !== 'mutoon') {
    const [r] = await db.query(
      `SELECT qc.from_person_id, qc.to_person_id, qc.transmission_type_id, tt.name_ar as tx_name
       FROM quran_connections qc
       LEFT JOIN transmission_types tt ON qc.transmission_type_id = tt.id
       WHERE qc.user_id = ?`, [userId]
    );
    quranEdges = await TxType.annotateQuran(r);
  }
  return { persons, matnEdges, quranEdges };
};

exports.getRiwayaQiraaMap = async () => {
  const [rows] = await db.query('SELECT id, qiraa_id FROM riwayat WHERE qiraa_id IS NOT NULL');
  return new Map(rows.map(r => [Number(r.id), Number(r.qiraa_id)]));
};