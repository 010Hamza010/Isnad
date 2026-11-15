import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personRoles, hasRole } from '../src/utils/personRoles.js';

const qiraat = [{ id: 5, name_ar: 'قراءة عاصم', imam_id: 105 }, { id: 9, name_ar: 'قراءة بلا إمام', imam_id: null }];
const riwayat = [
  { id: 9, name_ar: 'حفص عن عاصم', rawi_id: 119 },
  { id: 5, name_ar: 'الدوري عن أبي عمرو', rawi_id: 115 },
  { id: 14, name_ar: 'الدوري عن الكسائي', rawi_id: '115' },
  { id: 30, name_ar: 'رواية بلا راو', rawi_id: null },
];

test('imams come from qiraat.imam_id, rawis from riwayat.rawi_id', () => {
  const roles = personRoles(qiraat, riwayat);
  assert.deepEqual(roles.get(105), [{ kind: 'imam', label: 'إمام قراءة عاصم' }]);
  assert.deepEqual(roles.get(119), [{ kind: 'rawi', label: 'راوي حفص عن عاصم' }]);
  assert.equal(roles.size, 3);
});

test('a rawi of two riwayat gets both, ids matched as numbers', () => {
  const roles = personRoles(qiraat, riwayat);
  assert.deepEqual(roles.get(115).map(r => r.label), ['راوي الدوري عن أبي عمرو', 'راوي الدوري عن الكسائي']);
  assert.ok(hasRole(roles, '115', 'rawi'));
  assert.ok(!hasRole(roles, 115, 'imam'));
  assert.ok(!hasRole(roles, 1, 'rawi'));
});

test('empty lists give no roles', () => {
  assert.equal(personRoles().size, 0);
});
