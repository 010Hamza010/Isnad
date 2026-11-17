const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const M = require('../src/services/personMerge');

test('only two different real persons can be merged', () => {
  assert.deepEqual(M.checkPair('386', 267), [386, 267]);
  for (const [d, k] of [[1, 1], [0, 5], [5, -1], ['x', 2], [3, undefined]])
    assert.throws(() => M.checkPair(d, k), e => e.status === 400);
});

test('empty fields of the kept person are filled from the duplicate, never overwritten', () => {
  assert.deepEqual(M.fillFields({ death_year: '730هـ', century: null, region: '' }, { death_year: '731', century: 8, region: 'فاس', kunya: ' ' }),
    { century: 8, region: 'فاس' });
});

test('matn links move to the kept person; a self-link or a repeat of an existing link goes', () => {
  // the real case: 386 (duplicate of ابن سالم 267), 287 already linked to 267 without a matn
  const links = [
    { id: 41, from_person_id: 287, to_person_id: 267, matn_id: null },
    { id: 158, from_person_id: 287, to_person_id: 386, matn_id: 52 },
    { id: 193, from_person_id: 406, to_person_id: 386, matn_id: 52 },
    { id: 300, from_person_id: 287, to_person_id: 386, matn_id: null }, // = 41 once moved
    { id: 301, from_person_id: 386, to_person_id: 267, matn_id: 52 },   // becomes 267 → 267
    { id: 302, from_person_id: 386, to_person_id: 900, matn_id: 52 },
    { id: 303, from_person_id: 386, to_person_id: 901, matn_id: 52 },
    { id: 304, from_person_id: 267, to_person_id: 901, matn_id: 52 },   // 303 repeats it
  ];
  assert.deepEqual(M.planMatnLinks(links, 386, 267), {
    update: [{ id: 158, from: 287, to: 267 }, { id: 193, from: 406, to: 267 }, { id: 302, from: 267, to: 900 }],
    remove: [300, 301, 303],
  });
});

test('teacher orders: the duplicate is replaced, without repeating the kept one', () => {
  const r = M.mergeOrders({ 'm:52': [300, 386, 267], 'q:x': [5] }, 386, 267);
  assert.deepEqual(r, { orders: { 'm:52': [300, 267], 'q:x': [5] }, changed: true });
  assert.equal(M.mergeOrders({ 'm:1': [1] }, 386, 267).changed, false);
  assert.equal(M.mergeOrders(null, 386, 267).changed, false);
});

// ── PersonModel.merge against a scripted connection ──
const calls = [];
let ended = '';
const persons = { 386: { id: 386, name_ar: 'ابن سالم', uid: 'u-386', region: 'فاس' }, 267: { id: 267, name_ar: 'بن سالم', uid: 'u-267' } };
const conn = {
  beginTransaction: async () => {}, commit: async () => { ended = 'commit'; }, rollback: async () => { ended ||= 'rollback'; },
  release: () => {},
  query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM persons WHERE id=\? FOR UPDATE/.test(sql)) return [[persons[params[0]]].filter(Boolean)];
    if (/SELECT id, from_person_id/.test(sql)) return [[{ id: 193, from_person_id: 406, to_person_id: 386, matn_id: 52 }]];
    if (/SELECT COUNT/.test(sql)) return [[{ n: 0 }]];
    if (/SELECT user_id, value/.test(sql)) return [[{ user_id: 1, value: '{"m:52":[386]}' }]];
    return [{ affectedRows: /mutoon/.test(sql) ? 1 : 0 }];
  },
};
const dbPath = require.resolve(path.join(__dirname, '../config/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getConnection: async () => conn } };
const Person = require('../src/models/PersonModel');

test('merge moves everything, fills fields, remembers the old code, then deletes the duplicate', async () => {
  calls.length = 0; ended = '';
  const r = await Person.merge(386, 267);
  assert.equal(ended, 'commit');
  assert.deepEqual(r, { matn_moved: 1, matn_removed: 0, quran_moved: 0, quran_removed: 0, mutoon: 1, qiraat: 0, riwayat: 0, filled: ['region'] });
  const sqls = calls.map(c => c.sql);
  const at = re => sqls.findIndex(s => re.test(s));
  assert.ok(at(/UPDATE matn_connections/) < at(/DELETE FROM persons/));
  assert.deepEqual(calls[at(/UPDATE matn_connections/)].params, [406, 267, 193]);
  assert.deepEqual(calls[at(/UPDATE user_settings/)].params, ['{"m:52":[267]}', 1]);
  assert.deepEqual(calls[at(/UPDATE persons SET region/)].params, ['فاس', 267]);
  assert.deepEqual(calls[at(/INSERT INTO person_links/)].params, ['u-386', 267]);
});

test('dry run counts and rolls back; a missing person is a 404', async () => {
  ended = '';
  const r = await Person.merge(386, 267, { dryRun: true });
  assert.equal(ended, 'rollback');
  assert.equal(r.matn_moved, 1);
  ended = '';
  await assert.rejects(Person.merge(999, 267), e => e.status === 404);
  assert.equal(ended, 'rollback');
});
