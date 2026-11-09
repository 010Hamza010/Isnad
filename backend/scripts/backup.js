#!/usr/bin/env node
/**
 * Plain-SQL backup of the whole database, no mysqldump needed.
 *   npm run backup              → backups/isnad_db_YYYYMMDD-HHMMSS.sql
 *   npm run backup -- out.sql   → custom path
 * Restore: mysql -u root -p isnad_db < file.sql   (drops and recreates every table)
 * Values are kept as strings (dates, decimals, JSON) so nothing shifts with time zones or float rounding.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');

const DIR   = path.join(__dirname, '..', 'backups');
const BATCH = 200; // rows per INSERT

const pad = n => String(n).padStart(2, '0');
const backupName = (db, d = new Date()) =>
  `${db}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.sql`;

const qid = name => '`' + String(name).replace(/`/g, '``') + '`';

/** DROP + CREATE + batched INSERTs for one table. `escape` is the connection's value escaper. */
function tableSql(table, createSql, rows, escape) {
  const out = [`DROP TABLE IF EXISTS ${qid(table)};`, `${createSql};`];
  if (rows.length) {
    const cols = Object.keys(rows[0]).map(qid).join(', ');
    for (let i = 0; i < rows.length; i += BATCH) {
      const values = rows.slice(i, i + BATCH)
        .map(r => '(' + Object.values(r).map(v => escape(v)).join(', ') + ')')
        .join(',\n');
      out.push(`INSERT INTO ${qid(table)} (${cols}) VALUES\n${values};`);
    }
  }
  return out.join('\n') + '\n';
}

const header = (db, d = new Date()) => [
  `-- Isnad backup of ${db} — ${d.toISOString()}`,
  'SET NAMES utf8mb4;',
  'SET FOREIGN_KEY_CHECKS = 0;',
  "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';", // person 0 «أنا» must keep id 0
  '',
].join('\n');
const footer = 'SET FOREIGN_KEY_CHECKS = 1;\n';

async function main(outPath) {
  const db = process.env.DB_NAME || 'isnad_db';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: db,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    typeCast: (field, next) => (field.type === 'JSON' ? field.string() : next()),
  });

  const file = outPath ? path.resolve(outPath) : path.join(DIR, backupName(db));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.part`;
  const ws = fs.createWriteStream(tmp, 'utf8');
  const write = s => new Promise((res, rej) => ws.write(s, err => (err ? rej(err) : res())));

  try {
    await write(header(db));
    const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    let total = 0;
    for (const t of tables.map(r => Object.values(r)[0])) {
      const [[create]] = await conn.query(`SHOW CREATE TABLE ${qid(t)}`);
      const [rows] = await conn.query(`SELECT * FROM ${qid(t)}`);
      await write('\n' + tableSql(t, create['Create Table'], rows, v => conn.escape(v)));
      console.log(`  ${t}: ${rows.length} row(s)`);
      total += rows.length;
    }
    await write('\n' + footer);
    await new Promise((res, rej) => ws.end(err => (err ? rej(err) : res())));
    fs.renameSync(tmp, file); // only a complete dump gets the final name
    console.log(`Backed up ${tables.length} table(s), ${total} row(s) → ${file}`);
  } catch (err) {
    ws.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main(process.argv[2]).catch(err => {
    console.error(`\nBackup failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { backupName, tableSql, header, qid };
