const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const DR = require('../src/services/disabledRoutes');

const e = (from, to, name = `p${to}`) => ({ from_person_id: from, to_person_id: to, to_name: name });

test('scopes and route keys', () => {
  assert.equal(DR.matnScope('52'), 'm:52');
  assert.equal(DR.quranScope({ riwaya_id: '3' }), 'q:3-0-0');
  assert.equal(DR.quranScope({ qiraa_id: 2, tariq_id: 7 }), 'q:0-7-2');
  assert.equal(DR.routeKey(e(0, 5), [e(5, 6), e(6, 9)]), '0.5.6.9');
  assert.equal(DR.routeKey(e(0, 9), []), '0.9');
});

test('validate rejects bad scopes and keys, dedupes keys', () => {
  assert.deepEqual(DR.validate('m:1', ['0.5.9', '0.5.9', '0.-1']), ['0.5.9', '0.-1']);
  const bad = (s, k) => assert.throws(() => DR.validate(s, k), err => err.status === 400);
  bad('x:1', ['0.1']); bad('m:1; drop', ['0.1']); bad('m:1', []); bad('m:1', 'nope'); bad('m:1', ['0']); bad('m:1', ['0.a']);
});

test('setDisabled adds and removes keys per scope without touching others', () => {
  const a = DR.setDisabled(null, 'm:1', ['0.2.9'], true);
  const b = DR.setDisabled(a, 'm:2', ['0.3.9'], true);
  assert.deepEqual(b, { 'm:1': ['0.2.9'], 'm:2': ['0.3.9'] });
  assert.deepEqual(DR.setDisabled(b, 'm:1', ['0.2.9'], false), { 'm:2': ['0.3.9'] });
  assert.deepEqual(a, { 'm:1': ['0.2.9'] }); // not mutated
});

test('applyDisabled filters chains, keeps keys aligned, drops empty groups and lists the disabled ones', () => {
  const groups = [
    { firstEdge: e(0, 1, 'A'), chains: [[e(1, 9, 'Z')], [e(1, 2, 'B'), e(2, 9, 'Z')]] },
    { firstEdge: e(0, 3, 'C'), chains: [[e(3, 9, 'Z')]] },
  ];
  const { paths, disabled } = DR.applyDisabled(groups, ['0.1.9', '0.3.9']);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].keys, ['0.1.2.9']);
  assert.equal(paths[0].chains.length, 1);
  assert.deepEqual(disabled, [{ key: '0.1.9', names: ['A', 'Z'] }, { key: '0.3.9', names: ['C', 'Z'] }]);
  assert.equal(groups[0].chains.length, 2); // input not mutated
});

test('controller: switches routes off and on for the user', async () => {
  const store = {};
  const p = require.resolve(path.join(__dirname, '../src/models/SettingsModel'));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {
    get: async (u, k) => store[`${u}/${k}`] ?? null, set: async (u, k, v) => { store[`${u}/${k}`] = v; }, remove: async () => {},
  } };
  const c = require('../src/controllers/graphController');
  let body; const res = { json: b => { body = b; } };
  await c.setDisabledRoutes({ user: { id: 4 }, params: { scope: 'm:52' }, body: { keys: ['0.5.9', '0.6.9'] } }, res);
  assert.deepEqual(body.keys, ['0.5.9', '0.6.9']);
  await c.setDisabledRoutes({ user: { id: 4 }, params: { scope: 'm:52' }, body: { keys: ['0.5.9'], disabled: false } }, res);
  assert.deepEqual(store['4/disabled_routes'], { 'm:52': ['0.6.9'] });
});
