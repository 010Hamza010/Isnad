const db = require('../../config/db');

/** "from:to" pairs already recorded for this target (a matn, or my Quran connections). */
exports.existingPairs = async ({ target, matn_id, userId }) => {
  const [rows] = target === 'quran'
    ? await db.query('SELECT from_person_id f, to_person_id t FROM quran_connections WHERE user_id=?', [userId])
    : await db.query('SELECT from_person_id f, to_person_id t FROM matn_connections WHERE matn_id <=> ?', [matn_id || null]);
  return new Set(rows.map(r => `${r.f}:${r.t}`));
};

/** Apply a plan from services/isnadImport in one transaction. Edges marked `exists` are skipped. */
exports.apply = async (plan, { target, matn_id, items = [], userId }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ids = {};
    for (const p of plan.persons) {
      const [r] = await conn.query('INSERT INTO persons (name_ar, death_year, gender) VALUES (?,?,?)',
        [p.name_ar, p.death_year, p.gender]);
      ids[p.key] = r.insertId;
    }
    const idOf = ref => (typeof ref === 'number' ? ref : ids[ref]);

    let created = 0;
    for (const e of plan.edges) {
      if (e.exists) continue;
      const [from, to] = [idOf(e.from), idOf(e.to)];
      if (target === 'quran') {
        const [r] = await conn.query(
          'INSERT INTO quran_connections (user_id, from_person_id, to_person_id, transmission_type_id, reading_mode) VALUES (?,?,?,?,?)',
          [userId, from, to, e.transmission_type_id, e.reading_mode]);
        for (const it of items) {
          if (!it.qiraa_id && !it.riwaya_id && !it.tariq_id) continue;
          await conn.query('INSERT INTO quran_connection_items (connection_id, qiraa_id, riwaya_id, tariq_id) VALUES (?,?,?,?)',
            [r.insertId, it.qiraa_id || null, it.riwaya_id || null, it.tariq_id || null]);
        }
      } else {
        await conn.query(
          'INSERT INTO matn_connections (from_person_id, to_person_id, matn_id, transmission_type_id, is_general_ijaza, reading_mode) VALUES (?,?,?,?,?,?)',
          [from, to, matn_id || null, e.transmission_type_id, e.tx_kind === 'ijaza_general' ? 1 : 0, e.reading_mode]);
      }
      created++;
    }
    await conn.commit();
    return { persons_created: plan.persons.length, connections_created: created, connections_skipped: plan.edges.length - created };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};
