const { test } = require('node:test');
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
