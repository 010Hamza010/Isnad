const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/services/backupData');

const tables = {
  users: [{ id: 1, username: 'admin', password_hash: 'x' }],
  schema_migrations: [{ name: '001_user_settings.sql' }],
  persons: [{ id: 0, name_ar: 'أنا', death_year: null }, { id: 5, name_ar: 'ابن الجزري', death_year: '833' }],
  ijaza_files: [{ id: 1, ijaza_id: 2, data: Buffer.from('%PDF-1.4') }],
  user_settings: [{ user_id: 1, setting_key: 'profile', value: '{"full_name":"فلان"}' }],
};
const columns = {
  users: ['id', 'username', 'password_hash'], schema_migrations: ['name'],
  persons: ['id', 'name_ar', 'death_year', 'region'], ijaza_files: ['id', 'ijaza_id', 'data'],
  user_settings: ['user_id', 'setting_key', 'value'], mutoon: ['id', 'title'],
};

test('build leaves the account out and encodes binary columns', () => {
  const f = B.build(tables, ['002_b.sql', '001_a.sql'], new Date('2026-11-10T00:00:00Z'));
  assert.equal(f.format, 'isnad-backup');
  assert.deepEqual(Object.keys(f.tables), ['ijaza_files', 'persons', 'user_settings']);
  assert.deepEqual(f.migrations, ['001_a.sql', '002_b.sql']);
  assert.deepEqual(f.tables.ijaza_files[0].data, { $b64: Buffer.from('%PDF-1.4').toString('base64') });
  assert.deepEqual(B.counts(f.tables), { ijaza_files: 1, persons: 2, user_settings: 1 });
});

test('plan: round trip, user_id given to the current account, missing tables emptied, unknown columns dropped', () => {
  const f = JSON.parse(JSON.stringify(B.build(tables, ['001_a.sql'])));
  f.tables.persons[1].old_column = 'x';
  const steps = B.plan(f, { columns, applied: ['001_a.sql', '002_b.sql'], userId: 7 });
  const by = Object.fromEntries(steps.map(s => [s.table, s]));
  assert.deepEqual(Object.keys(by).sort(), ['ijaza_files', 'mutoon', 'persons', 'user_settings']);
  assert.deepEqual(by.persons.columns, ['id', 'name_ar', 'death_year']);
  assert.deepEqual(by.persons.rows[0], [0, 'أنا', null]);
  assert.ok(Buffer.isBuffer(by.ijaza_files.rows[0][2]));
  assert.equal(by.ijaza_files.rows[0][2].toString(), '%PDF-1.4');
  assert.equal(by.user_settings.rows[0][0], 7);
  assert.deepEqual(by.mutoon.rows, []);
});

test('plan refuses other files, newer versions and unknown tables', () => {
  const opts = { columns, applied: ['001_a.sql'] };
  const bad = (f, re) => assert.throws(() => B.plan(f, opts), e => e.status === 400 && re.test(e.message));
  bad({ hello: 1 }, /ليس نسخة/);
  bad({ format: 'isnad-backup', version: 2, tables: {} }, /أحدث/);
  bad({ format: 'isnad-backup', version: 1, migrations: ['099_x.sql'], tables: {} }, /099_x/);
  bad({ format: 'isnad-backup', version: 1, tables: { secrets: [] } }, /secrets/);
  bad({ format: 'isnad-backup', version: 1, tables: { users: [] } }, /users/);
});
