const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/services/heights');

const e = (from, to) => ({ from_person_id: from, to_person_id: to });

test('fewest counts the persons between me and the end of the chain', () => {
  const groups = [
    { firstEdge: e(0, 5), chains: [[e(5, 6), e(6, 9)], [e(5, 9)]] },   // 2 and 1 wasait
    { firstEdge: e(0, 7), chains: [[e(7, 8), e(8, 4), e(4, 9)]] },      // 3 wasait
  ];
  assert.deepEqual(H.fewest(groups), { wasait: 1, routes: 3 });
});

test('a direct link to the author has no wasait', () => {
  assert.deepEqual(H.fewest([{ firstEdge: e(0, 9), chains: [[]] }]), { wasait: 0, routes: 1 });
  assert.deepEqual(H.fewest([{ firstEdge: e(0, 9), chains: [] }]), { wasait: 0, routes: 1 });
});

test('with a target, the chain stops there (the sacred tail after the Prophet ﷺ is not counted)', () => {
  const groups = [{ firstEdge: e(0, 5), chains: [[e(5, 101), e(101, -1), e(-1, -2), e(-2, -3)], [e(5, 6)]] }];
  assert.deepEqual(H.fewest(groups, -1), { wasait: 2, routes: 1 });
});

test('no route → null', () => {
  assert.equal(H.fewest([]), null);
  assert.equal(H.fewest([{ firstEdge: e(0, 5), chains: [[e(5, 6)]] }], -1), null);
});

test('byHeight puts the highest isnad first', () => {
  const rows = [{ label: 'ب', wasait: 20 }, { label: 'أ', wasait: 18 }, { label: 'ج', wasait: 18 }];
  assert.deepEqual(H.byHeight(rows).map(r => r.label), ['أ', 'ج', 'ب']);
});

test('quranOptions: a whole qiraa counts as each of its riwayat', () => {
  const riwayat = [{ id: 7, qiraa_id: 5, name_ar: 'رواية شعبة' }, { id: 8, qiraa_id: 5, name_ar: 'رواية حفص' }];
  assert.deepEqual(H.quranOptions([{ riwaya_id: null, qiraa_id: 5, qiraa_name: 'قراءة عاصم' }], riwayat), [
    { riwaya_id: 7, label: 'رواية شعبة — قراءة عاصم' }, { riwaya_id: 8, label: 'رواية حفص — قراءة عاصم' },
  ]);
});

test('quranOptions keeps one entry per riwaya, or per qiraa when no riwaya is named', () => {
  const rows = [
    { riwaya_id: 3, qiraa_id: 1, riwaya_name: 'ورش', qiraa_name: 'قراءة نافع' },
    { riwaya_id: 3, qiraa_id: null, riwaya_name: 'ورش', qiraa_name: 'قراءة نافع' },
    { riwaya_id: null, qiraa_id: 5, riwaya_name: null, qiraa_name: 'قراءة عاصم' },
    { riwaya_id: null, qiraa_id: null },
  ];
  assert.deepEqual(H.quranOptions(rows), [
    { riwaya_id: 3, label: 'ورش — قراءة نافع' },
    { qiraa_id: 5, label: 'قراءة عاصم' },
  ]);
});

test('GET /graph/heights: general links reach every matn, disabled routes are left out, Quran stops at the Prophet ﷺ', async (t) => {
  const GM = require('../src/models/GraphModel');
  const Mutoon = require('../src/models/MutoonModel');
  const Settings = require('../src/models/SettingsModel');
  const c = require('../src/controllers/graphController');
  const DR = require('../src/services/disabledRoutes');
  const persons = new Map([[5, { name_ar: 'شيخي' }], [6, { name_ar: 'شيخه' }], [9, { name_ar: 'المؤلف' }],
    [8, { name_ar: 'مؤلف آخر' }], [101, { name_ar: 'نافع' }]]);
  const matnEdges = [
    { from_person_id: 0, to_person_id: 5, matn_id: null, is_general_ijaza: 1 },  // general: every matn
    { from_person_id: 5, to_person_id: 9, matn_id: 1, is_general_ijaza: 0 },
    { from_person_id: 5, to_person_id: 6, matn_id: 1, is_general_ijaza: 0 },
    { from_person_id: 6, to_person_id: 9, matn_id: 1, is_general_ijaza: 0 },
    { from_person_id: 5, to_person_id: 8, matn_id: 2, is_general_ijaza: 0 },
  ];
  // switch off the short route of matn 1: 0→5→9
  const shortKey = DR.routeKey({ from_person_id: 0, to_person_id: 5 }, [{ from_person_id: 5, to_person_id: 9 }]);
  t.mock.method(Mutoon, 'findAll', async () => [
    { id: 1, title: 'الجزرية', author_id: 9, author_name: 'المؤلف' },
    { id: 2, title: 'التحفة', author_id: 8, author_name: 'مؤلف آخر' },
    { id: 3, title: 'بلا مؤلف', author_id: null },
  ]);
  t.mock.method(GM, 'getAllMatnEdges', async () => matnEdges);
  t.mock.method(GM, 'getAllPersons', async () => persons);
  t.mock.method(Settings, 'get', async () => ({ [DR.matnScope(1)]: [shortKey] }));
  t.mock.method(GM, 'getMyQuranItems', async () => [{ riwaya_id: 3, qiraa_id: 1, riwaya_name: 'ورش', qiraa_name: 'قراءة نافع' }]);
  t.mock.method(GM, 'getRiwayaById', async () => ({ id: 3, qiraa_id: 1, imam_id: 101 }));
  t.mock.method(require('../src/models/QuranModel'), 'allRiwayat', async () => [{ id: 3, qiraa_id: 1, name_ar: 'ورش' }]);
  t.mock.method(GM, 'getQuranEdgesForUser', async () => [
    { from_person_id: 0, to_person_id: 5, items: [{ riwaya_id: 3 }] },
    { from_person_id: 5, to_person_id: 101, items: [{ riwaya_id: 3 }] },
  ]);
  t.mock.method(GM, 'getRiwayaQiraaMap', async () => new Map([[3, 1]]));

  let body;
  await c.heights({ user: { id: 1 } }, { json: b => { body = b; } });
  assert.deepEqual(body.mutoon.map(m => [m.label, m.wasait, m.routes]), [['التحفة', 1, 1], ['الجزرية', 2, 1]]);
  assert.deepEqual(body.quran.map(q => [q.label, q.wasait]), [['ورش — قراءة نافع', 2]]); // me → شيخي → نافع → ﷺ
});
