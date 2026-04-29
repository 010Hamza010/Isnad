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

exports.findById = async (id) => {
  const [[row]] = await db.execute('SELECT * FROM persons WHERE id=?', [id]);
  return row;
};

exports.create = async (data) => {
  const { name_ar, name_latin, kunya, nisba, century, death_year, region, description, primary_qiraa_id } = data;
  const [r] = await db.execute(
    'INSERT INTO persons (name_ar,name_latin,kunya,nisba,century,death_year,region,description,primary_qiraa_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [name_ar, name_latin||null, kunya||null, nisba||null, century||null, death_year||null, region||null, description||null, primary_qiraa_id||null]
  );
  return exports.findById(r.insertId);
};

exports.update = async (id, data) => {
  const { name_ar, name_latin, kunya, nisba, century, death_year, region, description, primary_qiraa_id } = data;
  await db.execute(
    'UPDATE persons SET name_ar=?,name_latin=?,kunya=?,nisba=?,century=?,death_year=?,region=?,description=?,primary_qiraa_id=? WHERE id=?',
    [name_ar, name_latin||null, kunya||null, nisba||null, century||null, death_year||null, region||null, description||null, primary_qiraa_id||null, id]
  );
  return exports.findById(id);
};

exports.remove = async (id) => {
  await db.execute('DELETE FROM persons WHERE id=?', [id]);
};
