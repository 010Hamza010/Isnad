const db = require('../../config/db');

exports.findByUsername = async (username) => {
  const [[user]] = await db.execute('SELECT * FROM users WHERE username=?', [username]);
  return user;
};

exports.create = async (username, password_hash) => {
  const [r] = await db.execute(
    'INSERT INTO users (username, password_hash) VALUES (?,?)',
    [username, password_hash]
  );
  return { id: r.insertId, username };
};
