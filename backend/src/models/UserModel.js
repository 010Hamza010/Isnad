const db = require('../../config/db');

exports.findByUsername = async (username) => {
  const [[user]] = await db.execute('SELECT * FROM users WHERE username=?', [username]);
  return user;
};

exports.findById = async (id) => {
  const [[user]] = await db.execute('SELECT * FROM users WHERE id=?', [id]);
  return user;
};

exports.count = async () => {
  const [[{ n }]] = await db.execute('SELECT COUNT(*) AS n FROM users');
  return Number(n);
};

/** The instance's single account; inserts only while there is none (returns null otherwise). */
exports.createFirst = async (username, password_hash) => {
  const [r] = await db.execute(
    'INSERT INTO users (username, password_hash) SELECT ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users)',
    [username, password_hash]
  );
  return r.affectedRows ? { id: r.insertId, username, token_version: 0 } : null;
};

exports.recordLogin = async (id) => {
  await db.execute('UPDATE users SET previous_login_at = last_login_at, last_login_at = NOW() WHERE id=?', [id]);
};

exports.setUsername = async (id, username) => {
  await db.execute('UPDATE users SET username=? WHERE id=?', [username, id]);
};

/** New password; every token issued before is no longer valid. */
exports.setPassword = async (id, password_hash) => {
  await db.execute('UPDATE users SET password_hash=?, token_version = token_version + 1 WHERE id=?', [password_hash, id]);
};

exports.bumpTokenVersion = async (id) => {
  await db.execute('UPDATE users SET token_version = token_version + 1 WHERE id=?', [id]);
};
