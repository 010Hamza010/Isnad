// End-to-end on the user's real data (test/fixtures/eg-matn52.json, extracted from eg.sql):
// a database whose transmission_types are numbered differently from the seed (migrations/000_base.sql)
// (1 بلفظ الشيخ، 2 قراءة، 3 سماع، 4 إجازة … 10 الإجازة العامة).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const FX = require('./fixtures/eg-matn52.json');

// minimal fake of config/db that answers the queries the real models make
const txById = new Map(FX.transmission_types.map(t => [t.id, t]));
const dbPath = require.resolve(path.join(__dirname, '../config/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  execute: async sql => {
    if (/FROM transmission_types/.test(sql)) return [FX.transmission_types];
    if (/FROM user_settings/.test(sql)) return [[]];
    throw new Error(`unexpected execute: ${sql}`);
  },
  query: async (sql, params) => {
    if (/FROM mutoon m/.test(sql)) {
      const m = FX.mutoon.find(x => x.id === Number(params[0]));
      const author = FX.persons.find(p => p.id === m.author_id);
      return [[{ ...m, author_name: author?.name_ar }]];
    }
    if (/FROM matn_connections mc/.test(sql)) {
      const id = Number(params[0]);
      return [FX.matn_connections
        .filter(c => c.matn_id === id || c.matn_id == null)
        .map(c => ({ ...c, tx_name: txById.get(c.transmission_type_id)?.name_ar ?? null }))];
    }
    if (/FROM persons/.test(sql)) return [FX.persons];
    throw new Error(`unexpected query: ${sql}`);
  },
} };

const graph = require('../src/controllers/graphController');
const T = require('../src/services/isnadText');

async function matnPaths(id) {
  let body;
  const res = { json: b => { body = b; }, status: () => res };
  await graph.matnPaths({ params: { id }, user: { id: 1 } }, res);
  return body;
}

test('connection 74 (type 3 = «سماع» in this database) wins over the general ijaza and is written as سماع', async t => {
  const { paths } = await matnPaths(52);
  const chains = paths.flatMap(T.groupChains);
  const links = chains.flatMap(c => c).filter(e => [265, 268].includes(Number(e.from_person_id)) && Number(e.to_person_id) === 266);
  assert.ok(links.length >= 2, 'both shuyukh reach 266');
  links.forEach(e => {
    assert.equal(e.transmission_type_id, 3);
    assert.equal(e.tx_kind, 'sama');
  });

  const text = T.renderChains(chains, { style: { clear: true } });
  t.diagnostic(text);
  assert.match(text, /سمع من/, text);
  assert.doesNotMatch(text, /أجاز/, text);
});

test('kinds are read from this database\'s names, not assumed from ids', async () => {
  const TxType = require('../src/models/TxTypeModel');
  const map = await TxType.kindMap();
  assert.deepEqual(map, { 1: 'lafz', 2: 'qiraa', 3: 'sama', 4: 'ijaza', 5: 'munawala', 6: 'kitaba', 7: 'ilam', 8: 'wijada', 9: 'wasiyya', 10: 'ijaza_general' });
});
