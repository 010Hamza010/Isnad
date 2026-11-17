const db = require('../../config/db');
const M = require('../services/personMerge');
const { HttpError } = require('../utils/httpError');

const SELECT_ALL = 'SELECT * FROM persons';

exports.findAll = async (q) => {
  let sql = SELECT_ALL;
  const params = [];
  if (q) { sql += ' WHERE name_ar LIKE ? OR name_latin LIKE ?'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY name_ar';
  const [rows] = await db.execute(sql, params);
  return rows;
};

// The list page sorts by and filters on how many links (hadith/matn or Quran, either side) a person has.
exports.findAllWithLinks = async (q) => {
  const [persons, [counts]] = await Promise.all([exports.findAll(q), db.query(`
    SELECT pid, COUNT(*) AS n FROM (
      SELECT from_person_id AS pid FROM matn_connections UNION ALL SELECT to_person_id FROM matn_connections
      UNION ALL SELECT from_person_id FROM quran_connections UNION ALL SELECT to_person_id FROM quran_connections
    ) l GROUP BY pid`)]);
  const byId = new Map(counts.map(c => [Number(c.pid), Number(c.n)]));
  return persons.map(p => ({ ...p, links_count: byId.get(Number(p.id)) || 0 }));
};

exports.findById = async (id) => {
  const [[row]] = await db.execute('SELECT * FROM persons WHERE id=?', [id]);
  return row;
};

exports.create = async (data) => {
  const { name_ar, name_latin, gender, kunya, nisba, century, death_year, region, description } = data;
  const [r] = await db.execute(
    'INSERT INTO persons (name_ar,name_latin,gender,kunya,nisba,century,death_year,region,description) VALUES (?,?,?,?,?,?,?,?,?)',
    [name_ar, name_latin||null, gender === 'F' ? 'F' : 'M', kunya||null, nisba||null, century||null, death_year||null, region||null, description||null]
  );
  return exports.findById(r.insertId);
};

exports.update = async (id, data) => {
  const { name_ar, name_latin, gender, kunya, nisba, century, death_year, region, description } = data;
  await db.execute(
    'UPDATE persons SET name_ar=?,name_latin=?,gender=?,kunya=?,nisba=?,century=?,death_year=?,region=?,description=? WHERE id=?',
    [name_ar, name_latin||null, gender === 'F' ? 'F' : 'M', kunya||null, nisba||null, century||null, death_year||null, region||null, description||null, id]
  );
  return exports.findById(id);
};

exports.remove = async (id) => {
  await db.execute('DELETE FROM persons WHERE id=?', [id]);
};

/**
 * Merge person `dropId` into `keepId` (services/personMerge), all in one transaction.
 * dryRun: count what would change and roll back. Returns the counts.
 */
exports.merge = async (dropId, keepId, { dryRun = false } = {}) => {
  const [drop_, keep_] = M.checkPair(dropId, keepId);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[drop]] = await conn.query('SELECT * FROM persons WHERE id=? FOR UPDATE', [drop_]);
    const [[keep]] = await conn.query('SELECT * FROM persons WHERE id=? FOR UPDATE', [keep_]);
    if (!drop || !keep) throw new HttpError(404, 'العلَم غير موجود');

    const [links] = await conn.query(
      'SELECT id, from_person_id, to_person_id, matn_id FROM matn_connections WHERE from_person_id IN (?,?) OR to_person_id IN (?,?)',
      [drop_, keep_, drop_, keep_]);
    const plan = M.planMatnLinks(links, drop_, keep_);
    for (const u of plan.update)
      await conn.query('UPDATE matn_connections SET from_person_id=?, to_person_id=? WHERE id=?', [u.from, u.to, u.id]);
    if (plan.remove.length) await conn.query('DELETE FROM matn_connections WHERE id IN (?)', [plan.remove]);

    // Quran: two links between the same people may name different riwayat, so they all move;
    // only a link that would join keep to himself is removed.
    const [[{ n: quranSelf }]] = await conn.query(
      'SELECT COUNT(*) n FROM quran_connections WHERE (from_person_id=? AND to_person_id=?) OR (from_person_id=? AND to_person_id=?)',
      [drop_, keep_, keep_, drop_]);
    if (quranSelf) await conn.query(
      'DELETE FROM quran_connections WHERE (from_person_id=? AND to_person_id=?) OR (from_person_id=? AND to_person_id=?)',
      [drop_, keep_, keep_, drop_]);
    const [qf] = await conn.query('UPDATE quran_connections SET from_person_id=? WHERE from_person_id=?', [keep_, drop_]);
    const [qt] = await conn.query('UPDATE quran_connections SET to_person_id=? WHERE to_person_id=?', [keep_, drop_]);

    const [a] = await conn.query('UPDATE mutoon SET author_id=? WHERE author_id=?', [keep_, drop_]);
    const [im] = await conn.query('UPDATE qiraat SET imam_id=? WHERE imam_id=?', [keep_, drop_]);
    const [rw] = await conn.query('UPDATE riwayat SET rawi_id=? WHERE rawi_id=?', [keep_, drop_]);
    await conn.query('UPDATE person_links SET person_id=? WHERE person_id=?', [keep_, drop_]);

    const [settings] = await conn.query("SELECT user_id, value FROM user_settings WHERE setting_key='ijaza_teacher_orders'");
    for (const s of settings) {
      let parsed; try { parsed = JSON.parse(s.value); } catch { continue; }
      const { orders, changed } = M.mergeOrders(parsed, drop_, keep_);
      if (changed) await conn.query("UPDATE user_settings SET value=? WHERE user_id=? AND setting_key='ijaza_teacher_orders'",
        [JSON.stringify(orders), s.user_id]);
    }

    const fill = M.fillFields(keep, drop);
    await conn.query('DELETE FROM persons WHERE id=?', [drop_]);
    if (Object.keys(fill).length)
      await conn.query(`UPDATE persons SET ${Object.keys(fill).map(f => `${f}=?`).join(', ')} WHERE id=?`, [...Object.values(fill), keep_]);
    // a file shared before the merge still names «drop» by its code: it now means «keep»
    if (drop.uid) await conn.query(
      'INSERT INTO person_links (uid, person_id) VALUES (?,?) ON DUPLICATE KEY UPDATE person_id = VALUES(person_id)', [drop.uid, keep_]);

    const result = {
      matn_moved: plan.update.length, matn_removed: plan.remove.length,
      quran_moved: qf.affectedRows + qt.affectedRows, quran_removed: Number(quranSelf),
      mutoon: a.affectedRows, qiraat: im.affectedRows, riwayat: rw.affectedRows, filled: Object.keys(fill),
    };
    if (dryRun) await conn.rollback(); else await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};
