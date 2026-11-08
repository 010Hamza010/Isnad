const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Stub the DB pool before GraphModel loads it.
const calls = [];
const dbPath = require.resolve(path.join(__dirname, '../config/db'));
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => { calls.push({ sql, params }); return [[{ id: 5, imam_id: 105 }], []]; } },
};
const GM = require('../src/models/GraphModel');

test('getQiraaById returns a single row, not the row array', async () => {
  const row = await GM.getQiraaById(5);
  assert.equal(row.imam_id, 105);
});

test('getFullGraphData scopes quran edges to the current user', async () => {
  calls.length = 0;
  await GM.getFullGraphData(42, 'quran');
  const q = calls.find(c => /quran_connections/.test(c.sql));
  assert.match(q.sql, /user_id = \?/);
  assert.deepEqual(q.params, [42]);
});
