#!/usr/bin/env node
/**
 * Minimal SQL migration runner.
 *   npm run migrate          apply pending migrations/NNN_name.sql in order
 *   npm run migrate:status   list applied / pending
 * Applied files are recorded in `schema_migrations`. MySQL DDL is not transactional, so keep
 * each file idempotent (CREATE TABLE IF NOT EXISTS…) — a failed file is not recorded and can be re-run.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');

const DIR = path.join(__dirname, '..', 'migrations');

const listMigrations = (dir = DIR) =>
  fs.readdirSync(dir).filter(f => /^\d+_[\w-]+\.sql$/.test(f)).sort();

const pending = (files, applied) => {
  const done = new Set(applied);
  return files.filter(f => !done.has(f));
};

// A database made before 000_base.sql existed already has the base tables (and its own rows):
// the file is recorded as applied without running, so deleted reference rows are not re-added.
const BASE = '000_base.sql';
const toBaseline = (todo, hasBaseTables) => (hasBaseTables && todo.includes(BASE) ? [BASE] : []);

async function main(cmd = 'up') {
  if (!['up', 'status'].includes(cmd)) throw new Error(`Unknown command "${cmd}" (use: up | status)`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'isnad_db',
    charset: 'utf8mb4',
    multipleStatements: true, // migration files are trusted, local, and may hold several statements
  });

  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name varchar(255) NOT NULL PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const files = listMigrations();
    let todo    = pending(files, rows.map(r => r.name));

    const [[{ n }]] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons'");
    const skip = toBaseline(todo, n > 0);
    if (cmd === 'up') {
      for (const f of skip) {
        await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
        console.log(`✓ ${f} recorded (existing database, not run)`);
      }
      todo = todo.filter(f => !skip.includes(f));
    }

    if (cmd === 'status') {
      files.forEach(f => console.log(`${todo.includes(f) ? '[ ]' : '[x]'} ${f}`));
      console.log(`\n${files.length - todo.length} applied, ${todo.length} pending`);
      return;
    }

    if (!todo.length) { console.log('Database is up to date.'); return; }
    for (const f of todo) {
      process.stdout.write(`→ ${f} … `);
      await conn.query(fs.readFileSync(path.join(DIR, f), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
      console.log('done');
    }
    console.log(`Applied ${todo.length} migration(s) to ${process.env.DB_NAME || 'isnad_db'}.`);
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main(process.argv[2]).catch(err => {
    console.error(`\nMigration failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { listMigrations, pending, toBaseline };
