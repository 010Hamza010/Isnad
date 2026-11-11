const { test } = require('node:test');
const assert = require('node:assert/strict');
const QC = require('../src/services/quranChain');
const graph = require('../src/controllers/graphController');
const GM = require('../src/models/GraphModel');
const Settings = require('../src/models/SettingsModel');

// عاصم 50 (imam), حفص 51 and شعبة 52 (rawis); حمزة 60 (imam), خلف 61 (rawi through سليم 62)
const riwayaQiraa = new Map([[1, 5], [2, 5], [3, 6]]);
const e = (from, to, items = []) => ({ from_person_id: from, to_person_id: to, items });

test('only my own links decide: nothing chosen covers nothing; a whole qiraa covers each riwaya', () => {
  const want = (o, tariq) => ({ qiraa_id: 5, riwaya_id: o, tariq });
  assert.equal(QC.startCovers(e(0, 9), want(1), riwayaQiraa), false);
  assert.equal(QC.startCovers(e(0, 9, [{ qiraa_id: 5 }]), want(1), riwayaQiraa), true);
  assert.equal(QC.startCovers(e(0, 9, [{ qiraa_id: 5 }]), { qiraa_id: 6, riwaya_id: 3 }, riwayaQiraa), false);
  assert.equal(QC.startCovers(e(0, 9, [{ riwaya_id: 2 }]), want(1), riwayaQiraa), false);
  assert.equal(QC.startCovers(e(0, 9, [{ riwaya_id: 1 }]), want(1), riwayaQiraa), true);
});

test('tariq: any, only links without one (0), or that tariq', () => {
  const tagged = e(0, 9, [{ riwaya_id: 1, tariq_id: 4 }]), plain = e(0, 8, [{ riwaya_id: 1 }]);
  const w = tariq => ({ qiraa_id: 5, riwaya_id: 1, tariq });
  assert.deepEqual([tagged, plain].map(x => QC.startCovers(x, w(undefined), riwayaQiraa)), [true, true]);
  assert.deepEqual([tagged, plain].map(x => QC.startCovers(x, w(0), riwayaQiraa)), [false, true]);
  assert.deepEqual([tagged, plain].map(x => QC.startCovers(x, w(4), riwayaQiraa)), [true, false]);
});

const fmt = x => ({ from_person_id: x.from_person_id, to_person_id: x.to_person_id });
const step = (from, to, extra) => ({ from_person_id: from, to_person_id: to, ...extra });
const ids = chain => chain.map(x => `${x.from_person_id}>${x.to_person_id}${x.auto ? '(auto)' : ''}${x.munqati ? '(منقطع)' : ''}`);

test('above the rawi: a direct step to the imam, then a منقطع jump to the Prophet ﷺ, then the tail', () => {
  const alts = QC.above({ rawiId: 51, imamId: 50, upper: [], fmt, step });
  assert.deepEqual(alts.map(ids), [['51>50(auto)', '50>-1(منقطع)', '-1>-2', '-2>-3']]);
});

test('entered links win: rawi through سليم to حمزة, and حمزة\'s own chain to the Prophet ﷺ', () => {
  const upper = [e(61, 62), e(62, 60), e(60, 70), e(70, -1)];
  const alts = QC.above({ rawiId: 61, imamId: 60, upper, fmt, step });
  assert.deepEqual(alts.map(ids), [['61>62', '62>60', '60>70', '70>-1', '-1>-2', '-2>-3']]);
});

test('every alternative above completes every route (keys follow their chains)', () => {
  const groups = [{ firstEdge: e(0, 9), chains: [[e(9, 51)]], keys: ['0.9.51'] }];
  const done = QC.completeGroups(groups, [[e(51, 50)], [e(51, 53), e(53, 50)]]);
  assert.equal(done[0].chains.length, 2);
  assert.deepEqual(done[0].keys, ['0.9.51', '0.9.51']);
});

test('GET /graph/quran/paths: whole-qiraa link of mine, complete links above, chain through حفص', async (t) => {
  t.mock.method(GM, 'getRiwayaById', async () => ({ id: 1, qiraa_id: 5, imam_id: 50, rawi_id: 51 }));
  t.mock.method(GM, 'getQuranEdgesForUser', async () => [
    e(0, 9, [{ qiraa_id: 5 }]),                  // I read عاصم (both riwayat) on 9
    e(0, 8),                                     // nothing chosen: not used
    e(9, 10, [{ riwaya_id: 3 }]),                // above me: complete, whatever it says
    e(10, 51),
    e(8, 51),
  ]);
  t.mock.method(GM, 'getAllPersons', async () => new Map([[9, { name_ar: 'شيخي' }], [10, { name_ar: 'شيخه' }],
    [51, { name_ar: 'حفص' }], [50, { name_ar: 'عاصم' }]]));
  t.mock.method(GM, 'getRiwayaQiraaMap', async () => riwayaQiraa);
  t.mock.method(Settings, 'get', async () => null);
  let body;
  await graph.quranPaths({ user: { id: 1 }, query: { riwaya_id: '1' } }, { json: b => { body = b; } });
  assert.equal(body.paths.length, 1);
  const p = body.paths[0];
  assert.deepEqual([p.firstEdge.to_person_id, ...p.chains[0].map(x => x.to_person_id)], [9, 10, 51, 50, -1, -2, -3]);
  const [toImam, jump] = p.chains[0].slice(2, 4);
  assert.deepEqual([toImam.to_name, toImam.auto, toImam.tx_kind], ['عاصم', true, 'qiraa']);
  assert.deepEqual([jump.to_name, jump.munqati], ['النبي ﷺ', true]);
  assert.deepEqual(p.chains[0][1].items, []);   // links above me carry no scope
});
