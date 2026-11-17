const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// persons: 0 me, 1 زياد, 2 الشامي, 3 ابن رافع, 9 ابن سالم (author of matn 52); 4 عمار (Quran)
const P = new Map([[1, 'زياد'], [2, 'الشامي'], [3, 'ابن رافع'], [9, 'ابن سالم'], [4, 'عمار'], [5, 'حفص']]
  .map(([id, name_ar]) => [id, { id, name_ar }]));
const m = (id, from, to, matn_id = 52) => ({ id, from_person_id: from, to_person_id: to, matn_id, is_general_ijaza: 0, tx_kind: null });
const MATN_EDGES = [m(1, 0, 1), m(2, 1, 2), m(3, 2, 3), m(4, 3, 9), m(5, 2, 9, 60)];
const stub = (file, exports) => {
  const p = require.resolve(path.join(__dirname, '../src/models', file));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
stub('GraphModel', {
  getAllPersons: async () => P,
  getAllMatnEdges: async () => MATN_EDGES,
  getMatnWithEdges: async id => (Number(id) === 52
    ? { matn: { id: 52, title: 'متن المثال', author_id: 9, author_name: 'ابن سالم' }, edges: MATN_EDGES.filter(e => e.matn_id === 52) }
    : { matn: undefined, edges: [] }),
  getQuranEdgesForUser: async () => [{ id: 1, from_person_id: 0, to_person_id: 4, items: [] }, { id: 2, from_person_id: 4, to_person_id: 5, items: [] }],
});
stub('SettingsModel', { get: async () => null });
const c = require('../src/controllers/graphController');
const names = d => d.paths.map(g => [g.firstEdge.to_name, ...g.chains.map(ch => ch.map(e => e.to_name).join('>'))]);

test('from another person to a matn\'s author, with that matn\'s links', async () => {
  const d = await c.betweenData(1, { from: '2', matn_id: '52' });
  assert.deepEqual(d.from, { id: 2, name: 'الشامي' });
  assert.deepEqual(d.target, { kind: 'matn', id: 52, name: 'متن المثال', author_name: 'ابن سالم' });
  assert.equal(d.end_id, 9);
  assert.deepEqual(names(d), [['ابن رافع', 'ابن سالم']]);   // 2→9 belongs to matn 60: not used
});

test('to a person: every matn link, from me or from anyone', async () => {
  assert.deepEqual(names(await c.betweenData(1, { to: '9' })), [['زياد', 'الشامي>ابن رافع>ابن سالم', 'الشامي>ابن سالم']]);
  assert.deepEqual(names(await c.betweenData(1, { from: '1', to: '3' })), [['الشامي', 'ابن رافع']]);
  // no route
  assert.deepEqual((await c.betweenData(1, { from: '3', to: '1' })).paths, []);
});

test('to a person with the Quran links', async () => {
  const d = await c.betweenData(1, { to: '5', module: 'quran' });
  assert.deepEqual(d.target, { kind: 'person', id: 5, name: 'حفص', module: 'quran' });
  assert.deepEqual(names(d), [['عمار', 'حفص']]);
});

test('bad requests: unknown person, same person, no target, unknown matn', async () => {
  await assert.rejects(c.betweenData(1, { from: '77', to: '9' }), e => e.status === 404);
  await assert.rejects(c.betweenData(1, { from: '9', to: '9' }), e => e.status === 400);
  await assert.rejects(c.betweenData(1, { from: '1' }), e => e.status === 400);
  await assert.rejects(c.betweenData(1, { from: '-3', to: '9' }), e => e.status === 400);
  await assert.rejects(c.betweenData(1, { from: '1', matn_id: '99' }), e => e.status === 404);
});
