const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildPaths, formatPath } = require('../src/services/graphService');

const e = (from, to, extra = {}) => ({ from_person_id: from, to_person_id: to, items: [], ...extra });
const names = (path) => path.map(x => `${x.from_person_id}>${x.to_person_id}`).join(' ');
const flatten = groups => groups.flatMap(g => g.chains.map(c => [g.firstEdge, ...c]));

test('finds every chain from me (0) to the target and groups by first hop', () => {
  const edges = [e(0, 1), e(1, 9), e(0, 2), e(2, 3), e(3, 9), e(2, 9)];
  const groups = buildPaths(edges, 0, [9], null, null, null, new Map(), null, null);
  assert.equal(groups.length, 2);
  const paths = flatten(groups).map(names).sort();
  assert.deepEqual(paths, ['0>1 1>9', '0>2 2>3 3>9', '0>2 2>9']);
});

test('returns no paths when the chain is munqati (never reaches target)', () => {
  const groups = buildPaths([e(0, 1), e(1, 2)], 0, [9], null, null, null, new Map(), null, null);
  assert.deepEqual(groups, []);
});

test('does not loop on cycles', () => {
  const groups = buildPaths([e(0, 1), e(1, 2), e(2, 1), e(2, 9)], 0, [9], null, null, null, new Map(), null, null);
  assert.deepEqual(flatten(groups).map(names), ['0>1 1>2 2>9']);
});

test('keeps the strongest transmission per pair (lowest type id, untyped last)', () => {
  const edges = [
    e(0, 1, { tx_kind: 'ijaza', tx_name: 'إجازة' }),
    e(0, 1, { tx_kind: 'sama', tx_name: 'سماع' }),
    e(0, 1, { tx_kind: null, tx_name: null }),
    e(1, 9),
  ];
  const [group] = buildPaths(edges, 0, [9], null, null, null, new Map(), null, null);
  assert.equal(group.firstEdge.tx_name, 'سماع');
});

test('scope filter runs before dedup: a second edge to the same shaykh with another riwaya is kept', () => {
  // two connections me → shaykh 1: one for riwaya 10 (sama'), one for riwaya 20 (ijaza)
  const edges = [
    e(0, 1, { tx_kind: 'sama', items: [{ riwaya_id: 10 }] }),
    e(0, 1, { tx_kind: 'ijaza', items: [{ riwaya_id: 20 }] }),
    e(1, 5),
  ];
  const groups = buildPaths(edges, 0, [5], 20, null, null, new Map(), null, null);
  assert.equal(groups.length, 1, 'riwaya-20 path must survive dedup');
  assert.equal(groups[0].firstEdge.items[0].riwaya_id, 20);
});

test('qiraa filter rejects edges whose items belong to another qiraa', () => {
  const riwayaQiraa = new Map([[10, 1], [20, 2]]);
  const edges = [
    e(0, 1, { items: [{ riwaya_id: 10 }] }),
    e(0, 2, { items: [{ qiraa_id: 2 }] }),
    e(1, 5), e(2, 5),
  ];
  const groups = buildPaths(edges, 0, [5], null, null, 2, new Map(), null, riwayaQiraa);
  assert.deepEqual(flatten(groups).map(names), ['0>2 2>5']);
});

test('unscoped edge to an imam of a different qiraa is rejected', () => {
  const imamMap = new Map([[5, 1], [6, 2]]); // imam person → qiraa
  const edges = [e(0, 1), e(1, 5), e(1, 6)];
  const groups = buildPaths(edges, 0, [5, 6], null, null, 2, new Map(), imamMap, null);
  assert.deepEqual(flatten(groups).map(names), ['0>1 1>6']);
});

test('formatPath labels me as أنا and resolves names', () => {
  const pMap = new Map([[1, { name_ar: 'الشيخ' }], [9, { name_ar: 'المؤلف' }]]);
  const [group] = buildPaths([e(0, 1), e(1, 9)], 0, [9], null, null, null, pMap, null, null);
  const out = formatPath(group, pMap);
  assert.equal(out.firstEdge.from_name, 'أنا');
  assert.equal(out.firstEdge.to_name, 'الشيخ');
  assert.equal(out.chains[0][0].to_name, 'المؤلف');
});

test('formatPath carries reading mode and death years for the text renderer', () => {
  const pMap = new Map([[1, { name_ar: 'أ', death_year: '1382' }]]);
  const [g] = buildPaths([e(0, 1, { reading_mode: 'heart', tx_kind: 'qiraa' })], 0, [1], null, null, null, pMap, null, null);
  const out = formatPath(g, pMap);
  assert.equal(out.firstEdge.reading_mode, 'heart');
  assert.equal(out.firstEdge.to_death_year, '1382');
});

describe('which connection wins between the same two people', () => {
  const pick = (...candidates) => buildPaths([...candidates, e(1, 9)], 0, [9], null, null, null, new Map(), null, null)[0].firstEdge;

  test('قراءة beats إجازة عامة, whatever the type numbers are', () => {
    assert.equal(pick(e(0, 1, { tx_kind: 'ijaza_general', tag: 'general' }), e(0, 1, { tx_kind: 'qiraa', tag: 'qiraa' })).tag, 'qiraa');
  });
  test('«قراءة عليه وأنا أسمع» (id 10) beats إجازة (3) and إجازة عامة (4)', () => {
    assert.equal(pick(e(0, 1, { tx_kind: 'ijaza', tag: 'ij' }), e(0, 1, { tx_kind: 'sama_reading', tag: 'listen' })).tag, 'listen');
    assert.equal(pick(e(0, 1, { tx_kind: 'sama_reading', tag: 'listen' }), e(0, 1, { tx_kind: 'ijaza_general', tag: 'gen' })).tag, 'listen');
  });
  test('the chosen type decides even when «إجازة عامة» is also ticked', () => {
    assert.equal(pick(e(0, 1, { tx_kind: 'ijaza', is_general_ijaza: 1, tag: 'ij' }), e(0, 1, { tx_kind: 'sama', is_general_ijaza: 1, tag: 'sama' })).tag, 'sama');
    assert.equal(pick(e(0, 1, { tx_kind: 'ijaza', is_general_ijaza: 1, tag: 'ij' }), e(0, 1, { tx_kind: 'kitaba', tag: 'kitaba' })).tag, 'ij');
  });
  test('the «عام — لكل المتون» box is a scope, not a type: it never makes a link an إجازة عامة; it loses ties', () => {
    assert.equal(pick(e(0, 1, { tx_kind: null, is_general_ijaza: 1, tag: 'gen' }), e(0, 1, { tx_kind: 'wijada', tag: 'wijada' })).tag, 'wijada');
    assert.equal(pick(e(0, 1, { tx_kind: 'sama', is_general_ijaza: 1, tag: 'ticked' }), e(0, 1, { tx_kind: 'sama', tag: 'plain' })).tag, 'plain');
  });
  test('same type: the connection for this matn beats a general one; untyped is last', () => {
    assert.equal(pick(e(0, 1, { tx_kind: 'qiraa', matn_id: null, tag: 'any' }), e(0, 1, { tx_kind: 'qiraa', matn_id: 7, tag: 'this' })).tag, 'this');
    assert.equal(pick(e(0, 1, { tx_kind: null, tag: 'none' }), e(0, 1, { tx_kind: 'wijada', tag: 'wijada' })).tag, 'wijada');
  });
});

test('the «عام» box does not change how a link is written: untyped stays «عن»', () => {
  const pMap = new Map([[1, { name_ar: 'أ' }]]);
  const [g] = buildPaths([e(0, 1, { is_general_ijaza: 1 })], 0, [1], null, null, null, pMap, null, null);
  assert.equal(formatPath(g, pMap).firstEdge.tx_kind, null);
  const [h] = buildPaths([e(0, 1, { is_general_ijaza: 1, tx_kind: 'sama' })], 0, [1], null, null, null, pMap, null, null);
  assert.equal(formatPath(h, pMap).firstEdge.tx_kind, 'sama');
});

test('the «عام» box and an empty matn are the same: no matn, box ticked', async () => {
  const path = require('node:path');
  const saved = [];
  const p = require.resolve(path.join(__dirname, '../src/models/MatnConnectionModel'));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {
    create: async b => { saved.push(b); return { id: 1 }; }, update: async (id, b) => { saved.push(b); },
  } };
  const c = require('../src/controllers/matnConnectionsController');
  const res = { json: b => b };
  await c.create({ body: { to_person_id: 5, matn_id: 52, is_general_ijaza: true } }, res);
  await c.update({ params: { id: 1 }, body: { to_person_id: 5, matn_id: 52, is_general_ijaza: false } }, res);
  await c.create({ body: { to_person_id: 5, matn_id: '', is_general_ijaza: false } }, res);
  assert.deepEqual([saved[0].matn_id, saved[0].is_general_ijaza], [null, true]);
  assert.deepEqual([saved[1].matn_id, saved[1].is_general_ijaza], [52, false]);
  assert.deepEqual([saved[2].matn_id, saved[2].is_general_ijaza], [null, true]);
});

test('formatPath marks general matn links (no matn or «عام»); Quran links never', () => {
  const g = { firstEdge: e(0, 1, { matn_id: 7, is_general_ijaza: 0 }), chains: [[e(1, 2, { matn_id: null }), e(2, 9, { matn_id: 7, is_general_ijaza: 1 })], [e(1, 9)]] };
  const out = formatPath(g, new Map());
  assert.equal(out.firstEdge.general, false);
  assert.deepEqual(out.chains[0].map(x => x.general), [true, true]);
  assert.equal(out.chains[1][0].general, false);
});
