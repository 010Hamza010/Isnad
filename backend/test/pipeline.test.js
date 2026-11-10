// End-to-end: rows as MySQL returns them → /graph/matn/:id/paths controller → ijaza isnad text.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let EDGES = [];
const gmPath = require.resolve(path.join(__dirname, '../src/models/GraphModel'));
require.cache[gmPath] = { id: gmPath, filename: gmPath, loaded: true, exports: {
  getMatnWithEdges: async () => ({ matn: { id: 7, title: 'متن', author_id: 3 }, edges: EDGES }),
  getAllPersons: async () => new Map([
    [1, { id: 1, name_ar: 'الشيخ', gender: 'M' }], [2, { id: 2, name_ar: 'شيخ الشيخ', gender: 'M' }], [3, { id: 3, name_ar: 'المؤلف', gender: 'M' }],
  ]),
} };
const stPath = require.resolve(path.join(__dirname, '../src/models/SettingsModel'));
require.cache[stPath] = { id: stPath, filename: stPath, loaded: true, exports: { get: async () => null } };
const graph = require('../src/controllers/graphController');
const T = require('../src/services/isnadText');

const TX = { 1: 'سماع', 2: 'قراءة على الشيخ', 3: 'إجازة', 4: 'إجازة عامة', 10: 'قراءة عليه وأنا أسمع' };
let nextId = 1;
// a matn_connections row joined with transmission_types, as the SQL returns it
const row = (from, to, tx, { matn = 7, general = 0 } = {}) => ({
  id: nextId++, from_person_id: from, to_person_id: to, matn_id: matn, transmission_type_id: tx,
  is_general_ijaza: general, reading_mode: null, description: null, tx_name: tx ? TX[tx] : null,
});

async function ijazaText(edges) {
  EDGES = edges;
  let body;
  await graph.matnPaths({ params: { id: 7 }, user: { id: 1 } }, { json: b => { body = b; }, status: () => ({ json: b => { body = b; } }) });
  assert.ok(body.paths?.length, JSON.stringify(body));
  return T.renderChains(body.paths.flatMap(T.groupChains), { style: { clear: true, firstTitle: '' } });
}

describe('two connections between the same people: the stronger one is used in the ijaza', () => {
  const tail = () => [row(2, 3, null)];
  const cases = [
    ['سماع for this matn + إجازة عامة (no matn)', [row(1, 2, 4, { matn: null, general: 1 }), row(1, 2, 1)]],
    ['سماع + إجازة عامة, both without matn', [row(1, 2, 4, { matn: null, general: 1 }), row(1, 2, 1, { matn: null })]],
    ['سماع ticked «إجازة عامة» too + an إجازة connection', [row(1, 2, 3, { matn: null, general: 1 }), row(1, 2, 1, { matn: null, general: 1 })]],
    ['سماع ticked «إجازة عامة» + untyped general ijaza', [row(1, 2, null, { matn: null, general: 1 }), row(1, 2, 1, { matn: null, general: 1 })]],
    ['order reversed', [row(1, 2, 1, { matn: null, general: 1 }), row(1, 2, 3, { matn: null, general: 1 })]],
  ];
  for (const [name, links] of cases) {
    test(name, async () => {
      const t = await ijazaText([row(0, 1, 2), ...links, ...tail()]);
      assert.match(t, /وهو سمع من شيخ الشيخ/, t);
      assert.doesNotMatch(t, /أجاز/, t);
    });
  }

  test('only a general ijaza exists → it is used', async () => {
    const t = await ijazaText([row(0, 1, 2), row(1, 2, 4, { matn: null, general: 1 }), ...tail()]);
    assert.match(t, /أجازه شيخ الشيخ إجازةً عامة/, t);
  });
});
