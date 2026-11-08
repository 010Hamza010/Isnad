const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const calls = [];
const modelPath = require.resolve(path.join(__dirname, '../src/models/PersonModel'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true,
  exports: { create: async d => { calls.push(d); return d; }, update: async (id, d) => { calls.push(d); return d; } } };
const c = require('../src/controllers/personsController');
const res = () => ({ json: b => b });

test('person gender accepts M/F/empty and rejects anything else', async () => {
  await c.create({ body: { name_ar: 'نزهة', gender: 'F' } }, res());
  await c.create({ body: { name_ar: 'زيد' } }, res());
  assert.equal(calls.length, 2);
  await assert.rejects(c.create({ body: { name_ar: 'x', gender: 'female' } }, res()), e => e.status === 400);
  await assert.rejects(c.update({ params: { id: 1 }, body: { name_ar: 'x', gender: 'f' } }, res()), e => e.status === 400);
});
