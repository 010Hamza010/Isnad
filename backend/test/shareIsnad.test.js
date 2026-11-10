const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/services/shareIsnad');
const { buildIndex } = require('../src/services/isnadText/resolve');
const { planImport } = require('../src/services/isnadImport');

// machine A: me → 7 (my shaykh) → 2 (ابن الجزري) ; me → 9 → 2 ; Quran tail must not travel
const e = (from, to, extra = {}) => ({ from_person_id: from, to_person_id: to, tx_kind: null, tx_name: null, ...extra });
const A = new Map([
  [7, { id: 7, uid: 'uid-aaaa-0007', name_ar: 'أحمد بن علي', death_year: '1400', gender: 'M' }],
  [9, { id: 9, uid: 'uid-aaaa-0009', name_ar: 'محمد بن علي', death_year: null, gender: 'M' }],
  [2, { id: 2, uid: 'uid-aaaa-0002', name_ar: 'محمد بن محمد ابن الجزري', kunya: 'أبو الخير', death_year: '833', gender: 'M' }],
]);
const paths = [
  { firstEdge: e(0, 7, { tx_kind: 'qiraa', tx_name: 'قراءة' }), chains: [[e(7, 2, { tx_kind: 'sama' }), e(2, -1), e(-1, -2)]] },
  { firstEdge: e(0, 9), chains: [[e(9, 2)]] },
];
const file = () => JSON.parse(JSON.stringify(S.buildShare({
  paths, persons: A, sender: { name_ar: 'الشيخ فلان', uid: 'uid-aaaa-me00' }, target: { type: 'matn', title: 'الجزرية', author_id: 2 },
})));

test('the file names people by ref, keeps routes, drops the sacred tail and local ids', () => {
  const f = file();
  assert.deepEqual(Object.keys(f.persons).sort(), ['me', 'p2', 'p7', 'p9']);
  assert.deepEqual(f.routes.map(r => r.map(s => s.to)), [['p7', 'p2'], ['p9', 'p2']]);
  assert.equal(f.routes[0][0].tx_kind, 'qiraa');
  assert.equal(f.target.author, 'p2');
  assert.equal(f.persons.p2.kunya, 'أبو الخير');
  assert.doesNotMatch(JSON.stringify(f.persons), /"id"/);
});

test('validate rejects other files and dangling refs', () => {
  assert.throws(() => S.validateShare({ format: 'x' }), err => err.status === 400);
  const f = file(); f.routes[0][0].to = 'p99';
  assert.throws(() => S.validateShare(f), err => /غير موجود/.test(err.message));
  const g = file(); g.routes[0][0].to = 'me';
  assert.throws(() => S.validateShare(g), err => err.status === 400);
});

// machine B: ابن الجزري is #3, the sender is known by name as #20, «محمد بن علي» is ambiguous
const B = [
  { id: 3, name_ar: 'محمد بن محمد ابن الجزري', death_year: '833' },
  { id: 20, name_ar: 'الشيخ فلان' },
  { id: 30, name_ar: 'محمد بن علي الفاسي' }, { id: 31, name_ar: 'محمد بن علي المكي' },
];
const preview = byUid => S.previewShare(S.validateShare(file()), { byUid, index: buildIndex(B), personsById: new Map(B.map(p => [p.id, p])) });

test('preview: name matches, ambiguous names, new persons; known codes link without asking', () => {
  const first = Object.fromEntries(preview(new Map()).rows.map(r => [r.ref, [r.status, r.person_id]]));
  assert.deepEqual(first.me, ['matched', 20]);
  assert.deepEqual(first.p2, ['matched', 3]);
  assert.equal(first.p9[0], 'ambiguous');
  assert.equal(first.p7[0], 'new');

  const again = Object.fromEntries(preview(new Map([['uid-aaaa-0009', 31]])).rows.map(r => [r.ref, [r.status, r.person_id]]));
  assert.deepEqual(again.p9, ['linked', 31]);
});

test('same name, another death year is not matched automatically', () => {
  const f = S.validateShare(file());
  f.persons.p2.death_year = '900';
  const r = S.previewShare(f, { byUid: new Map(), index: buildIndex(B), personsById: new Map(B.map(p => [p.id, p])) });
  assert.equal(r.rows.find(x => x.ref === 'p2').status, 'ambiguous');
});

test('toImport → fast-entry plan: ids of machine B, new persons keep their code, matches are remembered', () => {
  const f = S.validateShare(file());
  assert.throws(() => S.toImport(f, { me: 20, p2: 3, p7: 'new' }), err => /محمد بن علي/.test(err.message));
  const { chains, remember } = S.toImport(f, { me: 20, p2: 3, p7: 'new', p9: 31 }, { linkMe: true });
  const plan = planImport(chains, { types: [{ id: 5, name_ar: 'قراءة', kind: 'qiraa' }], existing: new Set(['0:20']) });
  const edges = plan.edges.map(x => `${x.from}>${x.to}${x.exists ? ' (exists)' : ''}`);
  assert.deepEqual(edges, ['0>20 (exists)', '20>ref:p7', 'ref:p7>3', '20>31', '31>3']);
  assert.deepEqual(plan.persons.map(p => [p.key, p.name_ar, p.uid]), [['ref:p7', 'أحمد بن علي', 'uid-aaaa-0007']]);
  assert.equal(plan.edges[1].transmission_type_id, 5);
  assert.deepEqual(remember.map(r => [r.uid, r.person_id]).sort(), [['uid-aaaa-0002', 3], ['uid-aaaa-0009', 31], ['uid-aaaa-me00', 20]]);
});

test('a person cannot be me, and a code already used here is not given to a new person', () => {
  const f = S.validateShare(file());
  assert.throws(() => S.toImport(f, { me: 0, p2: 3, p7: 'new', p9: 31 }), err => err.status === 400);
  const { chains } = S.toImport(f, { me: 20, p2: 'new', p7: 'new', p9: 31 }, { byUid: new Map([['uid-aaaa-0002', 3]]) });
  const p2 = chains[0].links[1];
  assert.equal(p2.new_key, 'p2');
  assert.equal(p2.uid, null);
});
