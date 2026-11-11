const db = require('../../config/db');

/** "from:to" pairs already recorded for this target (a matn, or my Quran connections). */
exports.existingPairs = async ({ target, matn_id, userId }) => {
  const [rows] = target === 'quran'
    ? await db.query('SELECT from_person_id f, to_person_id t FROM quran_connections WHERE user_id=?', [userId])
    : await db.query('SELECT from_person_id f, to_person_id t FROM matn_connections WHERE matn_id <=> ?', [matn_id || null]);
  return new Set(rows.map(r => `${r.f}:${r.t}`));
};

/** Apply a plan from services/isnadImport in one transaction. Edges marked `exists` are skipped. */
exports.apply = async (plan, opts) => {
  const { target, items = [], books = [], groups = [], userId } = opts;
  let { matn_id } = opts;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ids = {};
    for (const p of plan.persons) {
      // kunya / nisba / region / uid come with a shared isnad (services/shareIsnad)
      const extra = ['kunya', 'nisba', 'region', 'uid'].filter(k => p[k]);
      const [r] = await conn.query(
        `INSERT INTO persons (name_ar, death_year, gender${extra.map(k => `, ${k}`).join('')}) VALUES (?,?,?${extra.map(() => ',?').join('')})`,
        [p.name_ar, p.death_year, p.gender, ...extra.map(k => p[k])]);
      ids[p.key] = r.insertId;
    }
    const idOf = ref => (typeof ref === 'number' ? ref : ids[ref]);

    // a shared isnad may bring its matn: created once its author (maybe new) exists
    if (opts.new_matn) {
      const [r] = await conn.query('INSERT INTO mutoon (title, author_id) VALUES (?,?)',
        [opts.new_matn.title, opts.new_matn.author == null ? null : idOf(opts.new_matn.author)]);
      matn_id = r.insertId;
    }
    // codes of another instance's persons, remembered for the next import from there
    for (const l of opts.remember || [])
      await conn.query('INSERT INTO person_links (uid, person_id) VALUES (?,?) ON DUPLICATE KEY UPDATE person_id = VALUES(person_id)', [l.uid, l.person_id]);

    let created = 0;
    for (const e of plan.edges) {
      if (e.exists) continue;
      const [from, to] = [idOf(e.from), idOf(e.to)];
      if (target === 'quran') {
        const hasItems = items.some(it => it.qiraa_id || it.riwaya_id || it.tariq_id) || groups.length > 0;
        const [r] = await conn.query(
          'INSERT INTO quran_connections (user_id, from_person_id, to_person_id, is_general, transmission_type_id, reading_mode) VALUES (?,?,?,?,?,?)',
          // a link above mine with nothing named is «عام» (services/quranChain)
          [userId, from, to, from !== 0 && !hasItems ? 1 : 0, e.transmission_type_id, e.reading_mode]);
        for (const it of items) {
          if (!it.qiraa_id && !it.riwaya_id && !it.tariq_id) continue;
          await conn.query('INSERT INTO quran_connection_items (connection_id, qiraa_id, riwaya_id, tariq_id) VALUES (?,?,?,?)',
            [r.insertId, it.qiraa_id || null, it.riwaya_id || null, it.tariq_id || null]);
        }
        for (const b of books) await conn.query('INSERT IGNORE INTO quran_connection_books (connection_id, matn_id) VALUES (?,?)', [r.insertId, b]);
        for (const g of groups) await conn.query('INSERT IGNORE INTO quran_connection_groups (connection_id, group_id) VALUES (?,?)', [r.insertId, g]);
      } else {
        await conn.query(
          'INSERT INTO matn_connections (from_person_id, to_person_id, matn_id, transmission_type_id, is_general_ijaza, reading_mode) VALUES (?,?,?,?,?,?)',
          // no matn = valid for every matn («عام — لكل المتون»), as in the connection form
          [from, to, matn_id || null, e.transmission_type_id, matn_id ? 0 : 1, e.reading_mode]);
      }
      created++;
    }
    await conn.commit();
    return { persons_created: plan.persons.length, connections_created: created, connections_skipped: plan.edges.length - created, matn_id };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};
