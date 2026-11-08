const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let updates = [], failFirst = true;
const dbPath = require.resolve(path.join(__dirname, '../config/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  query: async (sql, params) => {
    if (/^UPDATE ijazat SET public_token/.test(sql)) {
      if (failFirst) { failFirst = false; const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
      updates.push(params); return [{}];
    }
    throw new Error(`unexpected: ${sql}`);
  },
} };
const Ijaza = require('../src/models/IjazaModel');

test('ijazat issued before verification get codes once; a unique-key collision is retried', async () => {
  const row = await Ijaza.ensureCodes({ id: 4, public_token: null, short_code: null });
  assert.match(row.short_code, /^ISN-/);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].slice(2), [4]);
  const again = await Ijaza.ensureCodes(row);       // already has codes: no write
  assert.equal(again, row);
  assert.equal(updates.length, 1);
});
