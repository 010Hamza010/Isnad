const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listMigrations, pending } = require('../scripts/migrate');

test('lists only NNN_name.sql files, in order', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  ['002_b.sql', '001_a.sql', 'notes.md', 'x.sql', '010_c.sql'].forEach(f => fs.writeFileSync(path.join(dir, f), ''));
  assert.deepEqual(listMigrations(dir), ['001_a.sql', '002_b.sql', '010_c.sql']);
  fs.rmSync(dir, { recursive: true });
});

test('pending skips applied files and keeps order', () => {
  assert.deepEqual(pending(['001_a.sql', '002_b.sql', '003_c.sql'], ['002_b.sql']), ['001_a.sql', '003_c.sql']);
});

test('the shipped migrations directory is valid', () => {
  assert.ok(listMigrations().includes('001_user_settings.sql'));
});

test('000_base.sql is recorded without running only on a database that already has tables', () => {
  const { toBaseline } = require('../scripts/migrate');
  assert.deepEqual(toBaseline(['000_base.sql', '001_a.sql'], true), ['000_base.sql']);
  assert.deepEqual(toBaseline(['000_base.sql', '001_a.sql'], false), []);
  assert.deepEqual(toBaseline(['001_a.sql'], true), []);
});

describe('000_base.sql', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '000_base.sql'), 'utf8');
  const created = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS `(\w+)`/g)].map(m => m[1]);
  const seeded = [...sql.matchAll(/INSERT IGNORE INTO `(\w+)`/g)].map(m => m[1]);

  test('runs first and is re-runnable', () => {
    assert.equal(listMigrations()[0], '000_base.sql');
    assert.doesNotMatch(sql, /CREATE TABLE `/);
    assert.doesNotMatch(sql, /INSERT INTO/);
    assert.doesNotMatch(sql, /^ALTER TABLE/m);
  });

  test('creates every base table and every table its keys point to', () => {
    for (const t of ['users', 'persons', 'qiraat', 'riwayat', 'turuq', 'transmission_types', 'mutoon',
      'matn_connections', 'quran_connections', 'quran_connection_items']) assert.ok(created.includes(t), t);
    for (const [, t] of sql.matchAll(/REFERENCES `(\w+)`/g)) assert.ok(created.includes(t), t);
  });

  test('seeds reference data only: no account, no links', () => {
    assert.deepEqual(seeded.sort(), ['mutoon', 'persons', 'qiraat', 'riwayat', 'transmission_types', 'turuq']);
    assert.doesNotMatch(sql, /password_hash`\) VALUES|\$2[aby]\$/);
  });

  test('every seeded qiraa imam and matn author is a seeded person', () => {
    const rows = table => sql.split(`INSERT IGNORE INTO \`${table}\``)[1].split(';')[0];
    const persons = new Set([...rows('persons').matchAll(/^\((-?\d+),/gm)].map(m => m[1]));
    for (const [, , ref] of rows('qiraat').matchAll(/^\((\d+), '[^']*', (\d+|NULL),/gm)) if (ref !== 'NULL') assert.ok(persons.has(ref), `imam ${ref}`);
    for (const [, , ref] of rows('mutoon').matchAll(/^\((\d+), '[^']*', (\d+|NULL),/gm)) if (ref !== 'NULL') assert.ok(persons.has(ref), `author ${ref}`);
  });
});
