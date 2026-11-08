const db = require('../../config/db');

exports.get = async (userId, key) => {
  const [[row]] = await db.execute('SELECT value FROM user_settings WHERE user_id=? AND setting_key=?', [userId, key]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
};

exports.set = async (userId, key, value) => {
  await db.execute(
    'INSERT INTO user_settings (user_id, setting_key, value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',
    [userId, key, JSON.stringify(value)]
  );
};

exports.remove = async (userId, key) => {
  await db.execute('DELETE FROM user_settings WHERE user_id=? AND setting_key=?', [userId, key]);
};
