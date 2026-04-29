const db = require('../../config/db');

const SELECT = `SELECT m.*, p.name_ar as author_name FROM mutoon m LEFT JOIN persons p ON p.id=m.author_id`;

exports.findAll = async () => {
  const [rows] = await db.execute(`${SELECT} ORDER BY m.subject, m.title`);
  return rows;
};

exports.findAllConnected = async () => {
  const [rows] = await db.execute(`
    SELECT DISTINCT m.*, p.name_ar AS author_name
    FROM mutoon m
    LEFT JOIN persons p ON p.id = m.author_id
    WHERE m.id IN (
      SELECT DISTINCT mc.matn_id
      FROM matn_connections mc
      WHERE mc.matn_id IS NOT NULL
    )`);
  return rows;
}

exports.findById = async (id) => {
  const [[row]] = await db.execute(`${SELECT} WHERE m.id=?`, [id]);
  return row;
};

exports.create = async ({ title, author_id, subject, description }) => {
  const [r] = await db.execute(
    'INSERT INTO mutoon (title,author_id,subject,description) VALUES (?,?,?,?)',
    [title, author_id||null, subject||null, description||null]
  );
  return exports.findById(r.insertId);
};

exports.update = async (id, { title, author_id, subject, description }) => {
  await db.execute(
    'UPDATE mutoon SET title=?,author_id=?,subject=?,description=? WHERE id=?',
    [title, author_id||null, subject||null, description||null, id]
  );
  return exports.findById(id);
};

exports.remove = async (id) => {
  await db.execute('DELETE FROM mutoon WHERE id=?', [id]);
};
