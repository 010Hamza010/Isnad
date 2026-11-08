const db = require('../../config/db');

exports.getMatnWithEdges = async (matnId) => {
  const [[matn]] = await db.query(
    `SELECT m.*, p.name_ar as author_name FROM mutoon m LEFT JOIN persons p ON m.author_id = p.id WHERE m.id = ?`,
    [matnId]
  );
  const [edges] = await db.query(
    `SELECT mc.*, tt.name_ar as tx_name FROM matn_connections mc
     LEFT JOIN transmission_types tt ON mc.transmission_type_id = tt.id
     WHERE mc.matn_id = ? OR mc.matn_id IS NULL`, [matnId]
  );
  return { matn, edges };
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
  }
  return edges;
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
  const [persons] = await db.query('SELECT id, name_ar, gender, death_year, description, primary_qiraa_id FROM persons');
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
      `SELECT mc.from_person_id, mc.to_person_id, mc.is_general_ijaza, tt.name_ar as tx_name, m.title as matn_title
       FROM matn_connections mc
       LEFT JOIN transmission_types tt ON mc.transmission_type_id = tt.id
       LEFT JOIN mutoon m ON mc.matn_id = m.id
       `
    );
    matnEdges = r;
  }
  if (module !== 'mutoon') {
    const [r] = await db.query(
      `SELECT qc.from_person_id, qc.to_person_id, tt.name_ar as tx_name
       FROM quran_connections qc
       LEFT JOIN transmission_types tt ON qc.transmission_type_id = tt.id
       WHERE qc.user_id = ?`, [userId]
    );
    quranEdges = r;
  }
  return { persons, matnEdges, quranEdges };
};

exports.getRiwayaQiraaMap = async () => {
  const [rows] = await db.query('SELECT id, qiraa_id FROM riwayat WHERE qiraa_id IS NOT NULL');
  return new Map(rows.map(r => [Number(r.id), Number(r.qiraa_id)]));
};