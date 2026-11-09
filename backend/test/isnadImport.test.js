const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { planImport, pickType, ImportError } = require('../src/services/isnadImport');
const T = require('../src/services/isnadText');

// numbered like the user's real DB: 3 = سماع, 4 = إجازة, 10 = الإجازة العامة
const TYPES = [
  { id: 1, name_ar: 'قراءة', kind: null, applies_to: 'both' },
  { id: 3, name_ar: 'سماع', kind: null, applies_to: 'both' },
  { id: 4, name_ar: 'إجازة', kind: null, applies_to: 'both' },
  { id: 7, name_ar: 'عرض القرآن', kind: 'ard', applies_to: 'quran' },
  { id: 10, name_ar: 'الإجازة العامة', kind: null, applies_to: 'both' },
];

test('pickType maps a kind to the lowest matching type id for the target', () => {
  assert.equal(pickType(TYPES, 'sama', 'matn'), 3);
  assert.equal(pickType(TYPES, 'ijaza_general', 'matn'), 10);
  assert.equal(pickType(TYPES, 'ard', 'quran'), 7);
  assert.equal(pickType(TYPES, 'ard', 'matn'), null); // quran-only type
  assert.equal(pickType(TYPES, null, 'matn'), null);
});

test('one chain from me: edges 0→A→new B, new person created once', () => {
  const plan = planImport([{ start: null, links: [
    { person_id: 5, name: 'زيد', tx_kind: 'sama' },
    { new_name: 'عمرو بن بكر', death_year: '852', tx_kind: 'ijaza' },
  ] }], { types: TYPES });
  assert.deepEqual(plan.persons, [{ key: 'new:عمرو بن بكر|852', name_ar: 'عمرو بن بكر', death_year: '852', gender: 'M' }]);
  assert.deepEqual(plan.edges.map(e => [e.from, e.to, e.transmission_type_id]), [[0, 5, 3], [5, 'new:عمرو بن بكر|852', 4]]);
});

test('shared tail after «كلاهما» and repeated new names are not duplicated', () => {
  const tail = [{ new_name: 'إدريس العراقي', tx_kind: 'sama' }, { person_id: 9, tx_kind: 'sama' }];
  const plan = planImport([
    { start: null, links: [{ person_id: 1, tx_kind: 'qiraa' }, ...tail] },
    { start: null, links: [{ person_id: 2, tx_kind: 'qiraa' }, ...tail] },
  ], { types: TYPES });
  assert.equal(plan.persons.length, 1);
  assert.deepEqual(plan.edges.map(e => `${e.from}>${e.to}`),
    ['0>1', '1>new:ادريس العراقي|', 'new:ادريس العراقي|>9', '0>2', '2>new:ادريس العراقي|']);
});

test('existing pairs are flagged so they are skipped; new persons never count as existing', () => {
  const plan = planImport([{ start: { person_id: 4 }, links: [{ person_id: 5 }, { new_name: 'x' }] }],
    { types: TYPES, existing: new Set(['4:5']) });
  assert.deepEqual(plan.edges.map(e => e.exists), [true, false]);
});

test('invalid input is rejected with a readable error', () => {
  const bad = chains => assert.throws(() => planImport(chains, { types: TYPES }), ImportError);
  bad([]);
  bad([{ start: null, links: [] }]);
  bad([{ start: null, links: [{ person_id: 0 }] }]);                    // link to me
  bad([{ start: { person_id: 3 }, links: [{ person_id: 3 }] }]);       // self link
  bad([{ start: null, links: [{ new_name: '  ' }] }]);                  // unresolved
  bad([{ start: null, links: [{ person_id: 3, reading_mode: 'x' }] }]);
});

test('parse → resolve → plan: unresolved names become new persons', () => {
  const parsed = T.parseIsnad('أخبرنا زيد بن ثابت قال حدثنا عمرو بن دينار (ت 126هـ)', null);
  const resolved = T.resolveChains(parsed, [{ id: 12, name_ar: 'زيد بن ثابت' }]);
  const chains = resolved.map(c => ({ start: c.start, links: c.links.map(l => (l.person_id != null
    ? { person_id: l.person_id, tx_kind: l.tx_kind } : { new_name: l.name, death_year: l.death_year, tx_kind: l.tx_kind })) }));
  const plan = planImport(chains, { types: TYPES });
  assert.equal(plan.persons.length, 1);
  assert.equal(plan.persons[0].name_ar, 'عمرو بن دينار');
  assert.equal(plan.persons[0].death_year, '126'); // «126هـ» stored as a plain year
  assert.equal(plan.edges[0].to, 12);
});

// ── controller with mocked models ──
const applied = [];
const mock = (rel, exports) => {
  const p = require.resolve(path.join(__dirname, '../src/models', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
mock('ImportModel', {
  existingPairs: async () => new Set(['0:5']),
  apply: async (plan, opts) => { applied.push({ plan, opts }); return { persons_created: plan.persons.length }; },
});
mock('TxTypeModel', { findAll: async () => TYPES, kindMap: async () => ({}) });
const c = require('../src/controllers/isnadTextController');
const res = () => ({ json: b => b });
const req = body => ({ body, user: { id: 7 } });

test('import: dry_run returns the plan without writing', async () => {
  const out = await c.import(req({ chains: [{ start: null, links: [{ person_id: 5 }] }], dry_run: true }), res());
  assert.equal(out.plan.edges[0].exists, true);
  assert.equal(applied.length, 0);
});

test('import: applies with the user and target', async () => {
  const out = await c.import(req({ target: 'quran', items: [{ riwaya_id: 2 }], chains: [{ start: null, links: [{ new_name: 'x' }] }] }), res());
  assert.equal(out.result.persons_created, 1);
  assert.deepEqual(applied[0].opts, { target: 'quran', matn_id: null, items: [{ riwaya_id: 2 }], userId: 7 });
});

test('import: bad target / chains → 400', async () => {
  await assert.rejects(c.import(req({ target: 'x', chains: [] }), res()), e => e.status === 400);
  await assert.rejects(c.import(req({ chains: [] }), res()), e => e.status === 400);
});
