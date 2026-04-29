const db = require('../../config/db');

exports.findAll = async () => {
  const [rows] = await db.execute(`
    SELECT mc.*,
      pf.name_ar as from_name, pt.name_ar as to_name,
      m.title as matn_title, tt.name_ar as tx_name
    FROM matn_connections mc
    LEFT JOIN persons pf ON pf.id = mc.from_person_id
    LEFT JOIN persons pt ON pt.id = mc.to_person_id
    LEFT JOIN mutoon m   ON m.id  = mc.matn_id
    LEFT JOIN transmission_types tt ON tt.id = mc.transmission_type_id
    ORDER BY mc.created_at DESC`);
  return rows;
};

exports.create = async ({ from_person_id, to_person_id, matn_id, transmission_type_id, is_general_ijaza, description }) => {
  const [r] = await db.execute(
    'INSERT INTO matn_connections (from_person_id,to_person_id,matn_id,transmission_type_id,is_general_ijaza,description) VALUES (?,?,?,?,?,?)',
    [from_person_id ?? 0, to_person_id, matn_id||null, transmission_type_id||null, is_general_ijaza ? 1 : 0, description||null]
  );
  return { id: r.insertId };
};

exports.update = async (id, { from_person_id, to_person_id, matn_id, transmission_type_id, is_general_ijaza, description }) => {
  await db.execute(
    'UPDATE matn_connections SET from_person_id=?,to_person_id=?,matn_id=?,transmission_type_id=?,is_general_ijaza=?,description=? WHERE id=?',
    [from_person_id ?? 0, to_person_id, matn_id||null, transmission_type_id||null, is_general_ijaza ? 1 : 0, description||null, id]
  );
};

exports.remove = async (id) => {
  await db.execute('DELETE FROM matn_connections WHERE id=?', [id]);
};
