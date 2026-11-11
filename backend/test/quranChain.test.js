const { test, describe } = require('node:test');
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

const Quran = require('../src/models/QuranModel');
const mockQuran = (t, edges, groups = []) => {
  t.mock.method(Quran, 'allGroups', async () => groups);
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

test('GET /graph/quran/paths: a link read with a group carries its members; the group stays on the step', async (t) => {
  const tenSmall = { id: 3, name_ar: 'العشر الصغرى', text_ar: 'القراءات العشر الصغرى', items: [{ qiraa_id: 5, riwaya_id: null }, { qiraa_id: 6, riwaya_id: null }] };
  const g = { group_id: 3, name_ar: 'العشر الصغرى', text_ar: 'القراءات العشر الصغرى' };
  mockQuran(t, [{ ...e(0, 9), groups: [g] }, { ...e(9, 51), groups: [g], is_general: 0 }], [tenSmall]);
  const p = await paths({ riwaya_id: '1' });
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].firstEdge.groups, [g]);
  assert.deepEqual(p[0].firstEdge.items, []);
  // a group without عاصم does not carry حفص
  t.mock.restoreAll();
  mockQuran(t, [{ ...e(0, 9), groups: [{ ...g, group_id: 4 }] }, { ...e(9, 51), is_general: 1 }], [{ id: 4, items: [{ qiraa_id: 6 }] }]);
  assert.deepEqual(await paths({ riwaya_id: '1' }), []);
});

test('saving: a group names what was read', () => {
  assert.equal(QC.checkScope({ from_person_id: 0, items: [], groups: [3] }), 0);
  assert.equal(QC.checkScope({ from_person_id: 9, groups: [3] }), 0);
});

// person 10 is ابن الجزري (a stop point by default)
const JAZARI = new Map([[9, { name_ar: 'شيخي' }], [10, { name_ar: 'محمد بن محمد بن الجزري' }], [11, { name_ar: 'شيخ آخر' }],
  [51, { name_ar: 'حفص' }], [50, { name_ar: 'عاصم' }], [52, { name_ar: 'شعبة' }]]);

describe('GET /graph/quran/group-paths', () => {
  // group 3 = عاصم (5) + حمزة (6); riwaya 1 حفص of عاصم, 2 خلف of حمزة
  const GROUP = { id: 3, name_ar: 'المجموعة', text_ar: 'قراءة عاصم وحمزة', books: [], items: [{ qiraa_id: 5, riwaya_id: null }, { qiraa_id: 6, riwaya_id: null }] };
  const RIW = [{ id: 1, qiraa_id: 5, name_ar: 'رواية حفص' }, { id: 2, qiraa_id: 6, name_ar: 'رواية خلف' }];
  const g = { group_id: 3 };
  const EDGES = [
    { ...e(0, 9), groups: [g] },                                  // I read the group on 9
    { ...e(9, 10), groups: [g], is_general: 0 },                  // 9 on 10 (the meeting point)
    { ...e(10, 51, [{ qiraa_id: 5 }]), is_general: 0 },           // above 10: per qiraa
    { ...e(10, 11, [{ qiraa_id: 6 }]), is_general: 0 },
  ];
  const groupPaths = async (t, query, stored = null) => {
    mockQuran(t, EDGES, [GROUP]);
    t.mock.method(Quran, 'allRiwayat', async () => RIW);
    t.mock.method(GM, 'getQiraaById', async id => ({ id: Number(id), imam_id: Number(id) === 5 ? 51 : 11 }));
    Settings.get.mock.mockImplementation(async (_, key) => (key === 'ijaza' ? stored : null));
    GM.getAllPersons.mock.mockImplementation(async () => JAZARI);
    let body;
    await graph.quranGroupPaths({ user: { id: 1 }, query: { group_id: '3', ...query } }, { json: b => { body = b; } });
    return body;
  };
  const people = p => p.flatMap(gr => gr.chains.map(c => [gr.firstEdge, ...c].map(x => x.to_person_id)));

  test('stop (the default): each imam\'s isnad cut at ابن الجزري, once, with «النشر»', async (t) => {
    const b = await groupPaths(t, {});
    assert.equal(b.mode, 'stop');
    assert.deepEqual(people(b.paths), [[9, 10, -9]]);
    const stop = b.paths[0].chains[0].at(-1);
    assert.equal(stop.group_stop, true);
    assert.match(stop.note, /كتابه النشر/);
    assert.deepEqual(b.riwayat.map(r => r.id), [1, 2]);
  });

  test('stop: a chain without a stop point is written whole', async (t) => {
    const b = await groupPaths(t, {}, { quran_group: { stops: [{ match: 'لا أحد', text: 'x' }] } });
    assert.deepEqual(people(b.paths).map(c => c.slice(0, 3)), [[9, 10, 51], [9, 10, 11]]);
  });

  test('riwaya: the chosen riwaya through my group links (default حفص), from the settings too', async (t) => {
    const b = await groupPaths(t, { mode: 'riwaya' });
    assert.equal(b.riwaya_id, 1);
    assert.deepEqual(people(b.paths)[0].slice(0, 3), [9, 10, 51]);
    t.mock.restoreAll();
    const s = await groupPaths(t, {}, { quran_group: { mode: 'riwaya', riwaya_id: 2 } });
    assert.deepEqual([s.mode, s.riwaya_id], ['riwaya', 2]);
  });

  test('all: one route per member', async (t) => {
    const b = await groupPaths(t, { mode: 'all' });
    assert.equal(b.paths.length, 2);
    assert.deepEqual(people(b.paths).map(c => c.slice(0, 3)), [[9, 10, 51], [9, 10, 11]]);
  });

  test('an unknown group is 404', async (t) => {
    mockQuran(t, EDGES, [GROUP]);
    t.mock.method(Quran, 'allRiwayat', async () => RIW);
    await assert.rejects(graph.quranGroupPaths({ user: { id: 1 }, query: { group_id: '99' } }, { json: () => {} }), e => e.status === 404);
  });
});

test('GET /graph/quran/paths: the imam\'s shaykhs per riwaya (عاصم: حفص via السلمي, شعبة via زر)', async (t) => {
  mockQuran(t, [
    e(0, 9, [{ riwaya_id: 1 }]),
    { ...e(9, 51), is_general: 1 },
    { ...e(50, 60, [{ riwaya_id: 1 }]), is_general: 0 },   // عاصم → السلمي: what became حفص
    { ...e(50, 61, [{ riwaya_id: 2 }]), is_general: 0 },   // عاصم → زر: what became شعبة
    { ...e(60, -1), is_general: 1 },
    { ...e(61, -1), is_general: 1 },
  ]);
  const p = await paths({ riwaya_id: '1' });
  const people = p.flatMap(g => g.chains.map(c => [g.firstEdge, ...c].map(x => x.to_person_id)));
  assert.deepEqual(people, [[9, 51, 50, 60, -1, -2, -3]]);
});

describe('GET /graph/quran/group-paths for a whole qiraa', () => {
  // qiraa 5 (عاصم, imam 50) with riwayat 1 حفص (rawi 51) and 2 شعبة (rawi 52)
  const RIW = [{ id: 1, qiraa_id: 5, name_ar: 'رواية حفص' }, { id: 2, qiraa_id: 5, name_ar: 'رواية شعبة' }];
  const EDGES = [
    e(0, 9, [{ qiraa_id: 5 }]),                          // I read all of عاصم on 9
    e(0, 8, [{ riwaya_id: 1 }]),                         // only حفص on 8: not «the whole qiraa»
    { ...e(9, 10, [{ qiraa_id: 5 }]), is_general: 0 },   // 10: the meeting point
    { ...e(10, 51, [{ riwaya_id: 1 }]), is_general: 0 },   // above 10: per riwaya
    { ...e(10, 52, [{ riwaya_id: 2 }]), is_general: 0 },
    { ...e(8, 51), is_general: 1 },
  ];
  const run = async (t, query) => {
    mockQuran(t, EDGES, []);
    t.mock.method(Quran, 'allRiwayat', async () => RIW);
    t.mock.method(GM, 'getQiraaById', async () => ({ id: 5, name_ar: 'قراءة عاصم', imam_id: 50 }));
    GM.getRiwayaById.mock.mockImplementation(async id => ({ id: Number(id), qiraa_id: 5, imam_id: 50, rawi_id: Number(id) === 1 ? 51 : 52 }));
    GM.getAllPersons.mock.mockImplementation(async () => JAZARI);
    let body;
    await graph.quranGroupPaths({ user: { id: 1 }, query: { qiraa_id: '5', ...query } }, { json: b => { body = b; } });
    return body;
  };
  const people = p => p.flatMap(gr => gr.chains.map(c => [gr.firstEdge, ...c].map(x => x.to_person_id)));

  test('stop: my links carrying all of عاصم, cut at ابن الجزري', async (t) => {
    const b = await run(t, { mode: 'stop' });
    assert.equal(b.group.qiraa_id, 5);
    assert.deepEqual(people(b.paths), [[9, 10, -9]]);
  });
  test('all: one isnad per riwaya, only through my whole-qiraa links', async (t) => {
    const b = await run(t, { mode: 'all' });
    assert.deepEqual(people(b.paths).map(c => c.slice(0, 3)), [[9, 10, 51], [9, 10, 52]]);
  });
  test('riwaya: the chosen one (default حفص)', async (t) => {
    const b = await run(t, { mode: 'riwaya' });
    assert.equal(b.riwaya_id, 1);
    assert.deepEqual(people(b.paths).map(c => c.slice(0, 3)), [[9, 10, 51]]);
  });
});
