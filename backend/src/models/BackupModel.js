const db = require('../../config/db');
const B = require('../services/backupData');

const qid = name => '`' + String(name).replace(/`/g, '``') + '`';
const BATCH = 200;
// keep values as MySQL writes them: no time zone shift on dates, JSON as text
const typeCast = (field, next) => (['DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'JSON', 'NEWDECIMAL'].includes(field.type) ? field.string() : next());

async function tableNames(conn = db) {
  const [rows] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  return rows.map(r => Object.values(r)[0]);
}

async function applied(conn = db) {
  try { const [rows] = await conn.query('SELECT name FROM schema_migrations'); return rows.map(r => r.name); }
  catch { return []; }
}

/** The whole database (minus the account) as the backup object. */
exports.dump = async () => {
  const tables = {};
  for (const t of await tableNames()) {
    if (B.SKIP.has(t)) continue;
    const [rows] = await db.query({ sql: `SELECT * FROM ${qid(t)}`, typeCast });
    tables[t] = rows;
  }
  return B.build(tables, await applied());
};

exports.summary = async () => {
  const out = {};
  for (const t of await tableNames()) {
    if (B.SKIP.has(t)) continue;
    const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${qid(t)}`);
    out[t] = Number(n);
  }
  return out;
};

/** Replace every table with the file's rows, in one transaction. */
exports.restore = async (file, userId) => {
  const conn = await db.getConnection();
  const [[{ mode }]] = await conn.query('SELECT @@SESSION.sql_mode AS mode');
  try {
    const columns = {};
    const [cols] = await conn.query(
      'SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY ORDINAL_POSITION');
    cols.forEach(r => { (columns[r.t] ??= []).push(r.c); });
    const steps = B.plan(file, { columns, applied: await applied(conn), userId });

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query("SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_AUTO_VALUE_ON_ZERO')"); // person 0 «أنا» keeps id 0
    await conn.beginTransaction();
    for (const s of steps) {
      await conn.query(`DELETE FROM ${qid(s.table)}`);
      for (let i = 0; i < s.rows.length; i += BATCH)
        await conn.query(`INSERT INTO ${qid(s.table)} (${s.columns.map(qid).join(', ')}) VALUES ?`, [s.rows.slice(i, i + BATCH)]);
    }
    await conn.commit();
    return Object.fromEntries(steps.map(s => [s.table, s.rows.length]));
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await conn.query('SET SESSION sql_mode = ?', [mode]).catch(() => {});
    conn.release();
  }
};
