const db = require('../../config/db');

exports.findAll = async (applies_to) => {
  let sql = 'SELECT * FROM transmission_types';
  const params = [];
  if (applies_to) { sql += " WHERE applies_to=? OR applies_to='both'"; params.push(applies_to); }
  const [rows] = await db.execute(sql, params);
  return rows;
};
