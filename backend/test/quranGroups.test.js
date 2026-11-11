const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/services/quranGroups');

test('a link\'s items get the members of its groups', () => {
  const groups = new Map([[3, { items: [{ qiraa_id: 5, riwaya_id: null }, { qiraa_id: null, riwaya_id: 7 }] }]]);
  assert.deepEqual(G.expandItems([{ qiraa_id: 1, riwaya_id: null, tariq_id: 2 }], [3, 99], groups), [
    { qiraa_id: 1, riwaya_id: null, tariq_id: 2 },
    { qiraa_id: 5, riwaya_id: null, tariq_id: null },
    { qiraa_id: null, riwaya_id: 7, tariq_id: null },
  ]);
  assert.deepEqual(G.expandItems(undefined, undefined), []);
});

test('a group needs a name and members; qiraat or riwayat, each once; books kept', () => {
  const bad = body => assert.throws(() => G.validateGroup(body), e => e.status === 400);
  bad({ name_ar: ' ', items: [{ qiraa_id: 1 }] });
  bad({ name_ar: 'الحرميان', items: [] });
  bad({ name_ar: 'الحرميان', items: [{ qiraa_id: '' }] });
  assert.deepEqual(G.validateGroup({ name_ar: ' قالون وورش ', text_ar: '', items: [{ riwaya_id: '2' }, { riwaya_id: 2 }, { qiraa_id: 1 }], books: ['4', 4, 'x'] }),
    { name_ar: 'قالون وورش', text_ar: null, description: null, items: [{ qiraa_id: null, riwaya_id: 2 }, { qiraa_id: 1, riwaya_id: null }], books: [4] });
});

// named like the seed: «قراءة الكسائي» has the imam «علي بن حمزة الكسائي» — must not be taken for حمزة
const qiraat = [
  { id: 1, name_ar: 'قراءة نافع', imam_name: 'نافع بن أبي نعيم' }, { id: 2, name_ar: 'قراءة ابن كثير', imam_name: 'عبد الله بن كثير' },
  { id: 3, name_ar: 'قراءة أبي عمرو', imam_name: 'أبو عمرو بن العلاء' }, { id: 4, name_ar: 'قراءة ابن عامر', imam_name: 'عبد الله بن عامر' },
  { id: 5, name_ar: 'قراءة عاصم', imam_name: 'عاصم بن أبي النجود' }, { id: 6, name_ar: 'قراءة حمزة', imam_name: 'حمزة بن حبيب الزيات' },
  { id: 7, name_ar: 'قراءة الكسائي', imam_name: 'علي بن حمزة الكسائي' }, { id: 8, name_ar: 'قراءة أبي جعفر', imam_name: 'أبو جعفر يزيد بن القعقاع' },
  { id: 10, name_ar: 'قراءة خلف العاشر', imam_name: 'خلف بن هشام' },
];
const mutoon = [{ id: 3, title: 'الشاطبية' }, { id: 4, title: 'طيبة النشر' }, { id: 5, title: 'الدرة المضية' }];

test('known groups: qiraat found by name, missing ones reported, books by title, existing names skipped', () => {
  const plan = G.planKnown({ qiraat, mutoon, existing: [{ name_ar: 'الحرميان' }] });
  assert.deepEqual(plan.map(g => g.name_ar), ['القراءات السبع', 'العشر الصغرى', 'العشر الكبرى', 'سما']);
  const [seven, small, big, sama] = plan;
  assert.deepEqual(seven.items.map(i => i.qiraa_id), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(seven.missing, []);
  assert.deepEqual(seven.books, [3]);
  assert.deepEqual(small.items.map(i => i.qiraa_id), [1, 2, 3, 4, 5, 6, 7, 8, 10]);
  assert.deepEqual(small.missing, ['قراءة يعقوب']);
  assert.deepEqual(small.books, [3, 5]);
  assert.deepEqual(big.books, [4]);
  assert.deepEqual(sama.items.map(i => i.qiraa_id), [1, 2, 3]);
});
