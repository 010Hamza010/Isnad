const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateOrder, setOrder } = require('../src/services/ijaza/teacherOrders');

test('an order is a key «m:<id>» / «q:<option>» and a unique list of integer ids', () => {
  assert.deepEqual(validateOrder('m:52', [3, '7', 3, 1]), [3, 7, 1]);
  assert.deepEqual(validateOrder('q:q1-r2-tnull', []), []);
  const bad = (k, ids) => assert.throws(() => validateOrder(k, ids), e => e.status === 400);
  bad('x:1', [1]); bad('m:', [1]); bad('m:1; drop', [1]); bad('m:1', 'nope'); bad('m:1', [1.5]); bad('m:1', Array(201).fill(0).map((_, i) => i));
});

test('setting one key keeps the others; an empty list removes the key', () => {
  const a = setOrder(null, 'm:1', [3, 2]);
  const b = setOrder(a, 'q:x', [9]);
  assert.deepEqual(b, { 'm:1': [3, 2], 'q:x': [9] });
  assert.deepEqual(setOrder(b, 'm:1', []), { 'q:x': [9] });
  assert.deepEqual(a, { 'm:1': [3, 2] }); // not mutated
});

test('controller: saves under its own settings key for the user', async () => {
  const store = {};
  const p = require.resolve(path.join(__dirname, '../src/models/SettingsModel'));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {
    get: async (u, k) => store[`${u}/${k}`] ?? null, set: async (u, k, v) => { store[`${u}/${k}`] = v; }, remove: async () => {},
  } };
  const c = require('../src/controllers/ijazatController');
  const res = () => ({ json: b => b });
  const out = await c.setTeacherOrder({ user: { id: 4 }, params: { key: 'm:52' }, body: { ids: [5, 2] } }, res());
  assert.deepEqual(out.orders, { 'm:52': [5, 2] });
  assert.deepEqual((await c.getTeacherOrders({ user: { id: 4 } }, res())).orders, { 'm:52': [5, 2] });
  assert.deepEqual((await c.getTeacherOrders({ user: { id: 5 } }, res())).orders, {});
  await assert.rejects(c.setTeacherOrder({ user: { id: 4 }, params: { key: 'bad' }, body: { ids: [] } }, res()), e => e.status === 400);
});
