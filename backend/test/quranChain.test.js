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

test('links above mine: «عام» carries everything, otherwise what they name (a tariq does not matter)', () => {
  const want = { qiraa_id: 5, riwaya_id: 1 };
  assert.equal(QC.upperCovers({ is_general: 1, items: [] }, want, riwayaQiraa), true);
  assert.equal(QC.upperCovers({ is_general: 0, items: [{ qiraa_id: 5 }] }, want, riwayaQiraa), true);
  assert.equal(QC.upperCovers({ is_general: 0, items: [{ riwaya_id: 1, tariq_id: 4 }] }, want, riwayaQiraa), true);
  assert.equal(QC.upperCovers({ is_general: 0, items: [{ qiraa_id: 6 }] }, want, riwayaQiraa), false);
  assert.equal(QC.upperCovers({ is_general: 0, items: [] }, want, riwayaQiraa), false);
});

test('saving: my link names what I read; a link above mine names it or is «عام»', () => {
  const bad = body => assert.throws(() => QC.checkScope(body), e => e.status === 400);
  bad({ from_person_id: 0, items: [] });
  bad({ from_person_id: 0, is_general: 1, items: [] });          // no «عام» for me
  bad({ from_person_id: 9, items: [{ qiraa_id: '' }] });
  assert.equal(QC.checkScope({ from_person_id: 0, items: [{ riwaya_id: 1 }] }), 0);
  assert.equal(QC.checkScope({ from_person_id: 0, is_general: true, items: [{ riwaya_id: 1 }] }), 0);
  assert.equal(QC.checkScope({ from_person_id: 9, is_general: true, items: [] }), 1);
  assert.equal(QC.checkScope({ from_person_id: 9, items: [{ qiraa_id: 5 }] }), 0);
});

const mockQuran = (t, edges) => {
  t.mock.method(GM, 'getRiwayaById', async () => ({ id: 1, qiraa_id: 5, imam_id: 50, rawi_id: 51 }));
  t.mock.method(GM, 'getQuranEdgesForUser', async () => edges);
  t.mock.method(GM, 'getAllPersons', async () => new Map([[9, { name_ar: 'شيخي' }], [10, { name_ar: 'شيخه' }],
    [11, { name_ar: 'شيخ آخر' }], [51, { name_ar: 'حفص' }], [50, { name_ar: 'عاصم' }]]));
  t.mock.method(GM, 'getRiwayaQiraaMap', async () => riwayaQiraa);
  t.mock.method(Settings, 'get', async () => null);
};
const paths = async query => {
  let body;
  await graph.quranPaths({ user: { id: 1 }, query }, { json: b => { body = b; } });
  return body.paths;
};

test('GET /graph/quran/paths: whole-qiraa link of mine, links above as entered, chain through حفص', async (t) => {
  mockQuran(t, [
    e(0, 9, [{ qiraa_id: 5 }]),                  // I read عاصم (both riwayat) on 9
    e(0, 8),                                     // nothing named: not used
    { ...e(9, 10, [{ qiraa_id: 5 }]), is_general: 0 },   // شيخي read عاصم on 10
    { ...e(10, 51), is_general: 1 },             // «عام»
    { ...e(9, 11, [{ qiraa_id: 6 }]), is_general: 0 },   // only حمزة: not for حفص
    { ...e(11, 51), is_general: 1 },
    { ...e(8, 51), is_general: 1 },
  ]);
  const p = await paths({ riwaya_id: '1' });
  assert.equal(p.length, 1);
  assert.equal(p[0].chains.length, 1);
  assert.deepEqual([p[0].firstEdge.to_person_id, ...p[0].chains[0].map(x => x.to_person_id)], [9, 10, 51, 50, -1, -2, -3]);
  const [toImam, jump] = p[0].chains[0].slice(2, 4);
  assert.deepEqual([toImam.to_name, toImam.auto, toImam.tx_kind], ['عاصم', true, 'qiraa']);
  assert.deepEqual([jump.to_name, jump.munqati], ['النبي ﷺ', true]);
  assert.deepEqual(p[0].chains[0][0].items, [{ qiraa_id: 5 }]);   // what my shaykh read stays visible
});

test('GET /graph/quran/paths: a link above naming another qiraa breaks the route', async (t) => {
  mockQuran(t, [e(0, 9, [{ riwaya_id: 1 }]), { ...e(9, 51, [{ qiraa_id: 6 }]), is_general: 0 }]);
  assert.deepEqual(await paths({ riwaya_id: '1' }), []);
});
