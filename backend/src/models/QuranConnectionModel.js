const db = require('../../config/db');
const TxType = require('./TxTypeModel');

/** Books read «بمضمنها» on each link: { [connection_id]: [{ matn_id, title }] }. */
async function booksOf(ids) {
  if (!ids.length) return {};
  const [rows] = await db.query(
    `SELECT b.connection_id, b.matn_id, m.title FROM quran_connection_books b
     JOIN mutoon m ON m.id = b.matn_id WHERE b.connection_id IN (?) ORDER BY m.title`, [ids]);
  const by = {};
  rows.forEach(r => { (by[r.connection_id] ??= []).push({ matn_id: r.matn_id, title: r.title }); });
  return by;
}
exports.booksOf = booksOf;

async function writeBooks(conn, id, books = []) {
  await conn.query('DELETE FROM quran_connection_books WHERE connection_id=?', [id]);
  const ids = [...new Set((Array.isArray(books) ? books : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  for (const matnId of ids) await conn.query('INSERT INTO quran_connection_books (connection_id, matn_id) VALUES (?,?)', [id, matnId]);
}

exports.findAllForUser = async (userId) => {
  const [conns] = await db.query(`
    SELECT qc.*, pf.name_ar as from_name, pt.name_ar as to_name, pf.gender as from_gender, pt.gender as to_gender, tt.name_ar as tx_name
    FROM quran_connections qc
    LEFT JOIN persons pf ON qc.from_person_id = pf.id
    LEFT JOIN persons pt ON qc.to_person_id   = pt.id
    LEFT JOIN transmission_types tt ON qc.transmission_type_id = tt.id
    WHERE qc.user_id = ? ORDER BY qc.id DESC`, [userId]);

  const ids = conns.map(c => c.id);
  if (ids.length) {
    const [items] = await db.query(`
      SELECT i.*, q.name_ar as qiraa_name, r.name_ar as riwaya_name, t.name_ar as tariq_name
      FROM quran_connection_items i
      LEFT JOIN qiraat  q ON i.qiraa_id  = q.id
      LEFT JOIN riwayat r ON i.riwaya_id = r.id
      LEFT JOIN turuq   t ON i.tariq_id  = t.id
      WHERE i.connection_id IN (?)`, [ids]);
    const iMap = {};
    items.forEach(it => { (iMap[it.connection_id] ??= []).push(it); });
    conns.forEach(c => { c.items = iMap[c.id] || []; });
  } else {
    conns.forEach(c => { c.items = []; });
  }
  const books = await booksOf(ids);
  conns.forEach(c => { c.books = books[c.id] || []; });
  return TxType.annotateQuran(conns);
};

exports.create = async (userId, fields, items, books) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(`
      INSERT INTO quran_connections
        (user_id,from_person_id,to_person_id,transmission_type_id,khatmat_count,ijaza_date,meeting_mode,reading_mode,notes,description)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [userId, fields.from_person_id ?? 0, fields.to_person_id,
       fields.transmission_type_id||null, fields.khatmat_count||1,
       fields.ijaza_date||null, fields.meeting_mode||'حضوراً', fields.reading_mode||null,
       fields.notes||null, fields.description||null]
    );
    const connId = result.insertId;
    await writeBooks(conn, connId, books);
    for (const item of items) {
      if (!item.qiraa_id && !item.riwaya_id && !item.tariq_id) continue;
      await conn.query(
        'INSERT INTO quran_connection_items (connection_id,qiraa_id,riwaya_id,tariq_id) VALUES (?,?,?,?)',
        [connId, item.qiraa_id||null, item.riwaya_id||null, item.tariq_id||null]
      );
    }
    await conn.commit();
    return { id: connId };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

exports.update = async (id, userId, fields, items, books) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`
      UPDATE quran_connections SET
        from_person_id=?,to_person_id=?,transmission_type_id=?,
        khatmat_count=?,ijaza_date=?,meeting_mode=?,reading_mode=?,notes=?,description=?
      WHERE id=? AND user_id=?`,
      [fields.from_person_id ?? 0, fields.to_person_id,
       fields.transmission_type_id||null, fields.khatmat_count||1,
       fields.ijaza_date||null, fields.meeting_mode||'حضوراً', fields.reading_mode||null,
       fields.notes||null, fields.description||null,
       id, userId]
    );
    await writeBooks(conn, id, books);
    await conn.query('DELETE FROM quran_connection_items WHERE connection_id=?', [id]);
    for (const item of items) {
      if (!item.qiraa_id && !item.riwaya_id && !item.tariq_id) continue;
      await conn.query(
        'INSERT INTO quran_connection_items (connection_id,qiraa_id,riwaya_id,tariq_id) VALUES (?,?,?,?)',
        [id, item.qiraa_id||null, item.riwaya_id||null, item.tariq_id||null]
      );
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

exports.remove = async (id, userId) => {
  await db.query('DELETE FROM quran_connections WHERE id=? AND user_id=?', [id, userId]);
};
