const { test } = require('node:test');
const assert = require('node:assert/strict');
const TH = require('../src/services/thabat');
const { buildIndex } = require('../src/services/isnadText/resolve');

// ── machine A: two mutoon, a general link, Quran with a riwaya and a tariq
const persons = new Map([
  [2, { id: 2, uid: 'uid-a-0002', name_ar: 'ابن الجزري', death_year: '833', description: 'إمام القراءات' }],
  [7, { id: 7, uid: 'uid-a-0007', name_ar: 'أحمد بن علي' }],
  [8, { id: 8, uid: 'uid-a-0008', name_ar: 'ابن عاشر', death_year: '1040' }],
  [9, { id: 9, uid: 'uid-a-0009', name_ar: 'نافع' }],
  [10, { id: 10, uid: 'uid-a-0010', name_ar: 'ورش' }],
]);
const data = {
  persons,
  mutoon: [{ id: 1, title: 'المرشد المعين', author_id: 8 }, { id: 4, title: 'متن لم يُصدَّر', author_id: 8 }],
  matnConns: [
    { from_person_id: 0, to_person_id: 7, matn_id: 1, is_general_ijaza: 0, tx_kind: 'qiraa' },
    { from_person_id: 7, to_person_id: 8, matn_id: null, is_general_ijaza: 1, tx_kind: null, description: 'إجازة عامة' },
  ],
  quranConns: [
    { from_person_id: 0, to_person_id: 2, tx_kind: 'qiraa', khatmat_count: 2, items: [{ qiraa_id: null, riwaya_id: 3, tariq_id: 5 }] },
    { from_person_id: 2, to_person_id: 10, tx_kind: null, items: [] },
  ],
  qiraat: [{ id: 6, name_ar: 'قراءة نافع', imam_id: 9 }],
  riwayat: [{ id: 3, name_ar: 'رواية ورش', qiraa_id: 6, rawi_id: 10 }],
  turuq: [{ id: 5, name_ar: 'طريق الأزرق', riwaya_id: 3, parent_id: null }],
};
const sender = { name_ar: 'الشيخ فلان', uid: 'uid-a-me00' };
const file = (opts = { mutoon: true, quran: true, bios: true }) => JSON.parse(JSON.stringify(TH.buildThabat(data, opts, sender)));

test('export: names and refs only, the mutoon and Quran names the links use, bios on request', () => {
  const f = file();
  assert.equal(f.format, 'isnad-thabat');
  assert.deepEqual(Object.keys(f.mutoon), ['m1']);
  assert.equal(f.mutoon.m1.author, 'p8');
  assert.deepEqual(f.links.map(l => [l.from, l.to, l.matn]), [['me', 'p7', 'm1'], ['p7', 'p8', null]]);
  assert.deepEqual(f.quran[0].items, [{ qiraa: null, riwaya: 'r3', tariq: 't5' }]);
  assert.deepEqual(Object.keys(f.qiraat), ['q6']);
  assert.equal(f.qiraat.q6.imam, 'p9');
  assert.equal(f.persons.p2.description, 'إمام القراءات');
  assert.equal(file({ mutoon: true, quran: false, bios: false }).persons.p2, undefined);
  assert.equal(file({ mutoon: [4], quran: false }).links.length, 1, 'only the general link: matn 1 not chosen');
});

test('validate rejects dangling refs and other files', () => {
  assert.throws(() => TH.validateThabat({ format: 'isnad-share' }), e => e.status === 400);
  const f = file(); f.links[0].to = 'p99';
  assert.throws(() => TH.validateThabat(f), e => /غير موجود/.test(e.message));
  const g = file(); g.quran[0].items[0].riwaya = 'r77';
  assert.throws(() => TH.validateThabat(g), e => e.status === 400);
});

// ── machine B: other ids; has ابن الجزري (#3, no bio), the matn, قراءة نافع but not the riwaya
const B = new Map([
  [3, { id: 3, name_ar: 'ابن الجزري', death_year: '833', description: null }],
  [20, { id: 20, name_ar: 'الشيخ فلان' }],
  [21, { id: 21, name_ar: 'نافع' }],
]);
const local = { mutoon: [{ id: 40, title: 'المرشد المعين' }], qiraat: [{ id: 50, name_ar: 'قراءة نافع' }], riwayat: [], turuq: [] };
const ctxPreview = { byUid: new Map(), index: buildIndex([...B.values()]), personsById: B, local };

test('preview: persons and mutoon resolved, Quran names found or to create', () => {
  const f = TH.validateThabat(file());
  const p = TH.previewThabat(f, ctxPreview);
  const st = Object.fromEntries(p.persons.map(r => [r.ref, [r.status, r.person_id]]));
  assert.deepEqual(st.me, ['matched', 20]);
  assert.deepEqual(st.p2, ['matched', 3]);
  assert.equal(st.p7[0], 'new');
  assert.deepEqual(p.mutoon.map(m => [m.ref, m.status, m.matn_id]), [['m1', 'matched', 40]]);
  assert.deepEqual(p.quranNames.map(q => [q.ref, q.local_id]), [['q6', 50], ['r3', null], ['t5', null]]);
});

test('plan: creates what is missing, skips what exists, fills only empty fields, remembers codes', () => {
  const f = TH.validateThabat(file());
  const picks = { persons: { me: 20, p2: 3, p7: 'new', p8: 'new', p9: 21, p10: 'new' }, mutoon: { m1: 40 } };
  const plan = TH.planThabat(f, picks, {
    byUid: new Map(), types: [{ id: 1, kind: 'qiraa' }], qmap: TH.mapQuran(f, local), personsById: B,
    existingMatn: new Set(), existingQuran: new Set(['20:3:/ref:r3/ref:t5']),
  });
  assert.deepEqual(plan.persons.map(p => [p.key, p.uid]), [['ref:p7', 'uid-a-0007'], ['ref:p8', 'uid-a-0008'], ['ref:p10', 'uid-a-0010']]);
  assert.deepEqual(plan.fills, [{ id: 3, name_ar: 'ابن الجزري', fields: { description: 'إمام القراءات' } }]);
  assert.deepEqual(plan.remember.map(r => r.uid).sort(), ['uid-a-0002', 'uid-a-0009', 'uid-a-me00']);
  assert.deepEqual(plan.qiraat, []);
  assert.deepEqual(plan.riwayat.map(r => [r.key, r.qiraa, r.rawi]), [['ref:r3', 50, 'ref:p10']]);
  assert.deepEqual(plan.turuq.map(t => [t.key, t.riwaya]), [['ref:t5', 'ref:r3']]);
  assert.deepEqual(plan.matnLinks.map(l => [l.from, l.to, l.matn, l.transmission_type_id]), [[20, 'ref:p7', 40, 1], ['ref:p7', 'ref:p8', null, null]]);
  assert.deepEqual(plan.quranLinks.map(l => [l.from, l.to, l.exists]), [[20, 3, false], [3, 'ref:p10', false]]);
  assert.deepEqual(TH.planCounts(plan), { persons: 3, fills: 1, mutoon: 0, quranNames: 2, links: 4, existing: 0 });
});

test('plan: an existing link is skipped; unresolved names stop it; «me» can not be picked', () => {
  const f = TH.validateThabat(file({ mutoon: true, quran: false }));
  const ctx = { byUid: new Map(), types: [], qmap: {}, personsById: B, existingMatn: new Set(['20:3:40']), existingQuran: new Set() };
  assert.throws(() => TH.planThabat(f, { persons: { me: 20 }, mutoon: { m1: 40 } }, ctx), e => /حدّد الأعلام/.test(e.message));
  assert.throws(() => TH.planThabat(f, { persons: { me: 0, p7: 'new', p8: 'new' }, mutoon: { m1: 40 } }, ctx), e => e.status === 400);
  const plan = TH.planThabat(f, { persons: { me: 20, p7: 3, p8: 'new' }, mutoon: { m1: 'new' } }, { ...ctx, existingMatn: new Set() });
  assert.deepEqual(plan.mutoon.map(m => [m.title, m.author]), [['المرشد المعين', 'ref:p8']]);
  assert.equal(plan.matnLinks[0].matn, 'ref:m1');
  const again = TH.planThabat(f, { persons: { me: 20, p7: 3, p8: 21 }, mutoon: { m1: 40 } }, { ...ctx, existingMatn: new Set(['20:3:40', '3:21:g']) });
  assert.deepEqual(TH.planCounts(again).existing, 2);
});
