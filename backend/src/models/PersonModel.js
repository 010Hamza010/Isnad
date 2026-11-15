const db = require('../../config/db');

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
