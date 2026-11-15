import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPersons, kindCounts, facets, paginate, pageNumbers, missing } from '../src/utils/personList.js';
import { personRoles } from '../src/utils/personRoles.js';

const P = [
  { id: -1, name_ar: 'النبي ﷺ' },
  { id: 105, name_ar: 'عاصم بن أبي النجود', century: 2, death_year: '127هـ', region: 'الكوفة', links_count: 3 },
  { id: 119, name_ar: 'حفص بن سليمان', century: 2, death_year: '180هـ', region: 'الكوفه', links_count: 5 },
  { id: 300, name_ar: 'ابن الجزري', century: 9, death_year: '833هـ', region: 'دمشق', links_count: 9 },
  { id: 301, name_ar: 'أحمد', links_count: 0 },
];
const roles = personRoles([{ name_ar: 'قراءة عاصم', imam_id: 105 }], [{ name_ar: 'حفص عن عاصم', rawi_id: 119 }]);
const names = l => l.map(p => p.name_ar);

test('kind tabs: imams, rawis, others', () => {
  assert.deepEqual(names(filterPersons(P, roles, { kind: 'imam' })), ['عاصم بن أبي النجود']);
  assert.deepEqual(names(filterPersons(P, roles, { kind: 'rawi' })), ['حفص بن سليمان']);
  assert.equal(filterPersons(P, roles, { kind: 'others' }).length, 3);
});

test('century and region (spelling variants merged) combine; kind counts follow the other filters', () => {
  const f = { century: '2', region: 'الكوفة' };
  assert.deepEqual(names(filterPersons(P, roles, f)).sort(), ['حفص بن سليمان', 'عاصم بن أبي النجود'].sort());
  assert.deepEqual(kindCounts(P, roles, f), { all: 2, imam: 1, rawi: 1, others: 0 });
});

test('search ignores hamza: «احمد» finds «أحمد»', () => {
  assert.deepEqual(names(filterPersons(P, roles, { q: 'احمد' })), ['أحمد']);
});

test('«يحتاج إكمالاً»: what is missing, the fixed persons never listed', () => {
  assert.deepEqual(missing(P[4]), ['سنة الوفاة', 'القرن', 'الروابط']);
  assert.deepEqual(missing(P[0]), []);
  assert.deepEqual(names(filterPersons(P, roles, { incomplete: true })), ['أحمد']);
});

test('sort by death year (unknown last) and by most links', () => {
  assert.deepEqual(names(filterPersons(P, roles, { sort: 'death' })).slice(0, 3), ['عاصم بن أبي النجود', 'حفص بن سليمان', 'ابن الجزري']);
  assert.equal(filterPersons(P, roles, { sort: 'links' })[0].name_ar, 'ابن الجزري');
});

test('facets list centuries in order and one region per spelling', () => {
  const f = facets(P);
  assert.deepEqual(f.centuries, [{ value: '2', count: 2 }, { value: '9', count: 1 }]);
  assert.equal(f.regions.length, 2);
  assert.equal(f.regions.find(r => r.count === 2).value, 'الكوفة');
});

test('paginate clamps the page and reports the range', () => {
  const list = Array.from({ length: 120 }, (_, i) => i);
  assert.deepEqual({ ...paginate(list, 3), items: undefined }, { items: undefined, page: 3, pages: 3, from: 101, to: 120, total: 120 });
  assert.equal(paginate(list, 99).page, 3);
  assert.equal(paginate([], 1).from, 0);
});

test('page numbers keep the ends and two around the current page', () => {
  assert.deepEqual(pageNumbers(6, 25), [1, '…', 4, 5, 6, 7, 8, '…', 25]);
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
});
