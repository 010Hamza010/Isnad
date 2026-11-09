import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReview, unresolved, toImportChains, pickOptions, NEW } from '../src/utils/fastEntry.js';

// two chains joined by «كلاهما»: the shared tail repeats in both
const tail = [
  { keyword: 'عن', tx_kind: null, name: 'إدريس العراقي', status: 'new', candidates: [] },
  { keyword: 'عن', tx_kind: null, name: 'المؤلف', status: 'matched', person_id: 9, candidates: [{ id: 9, name_ar: 'المؤلف', score: 1 }] },
];
const PARSED = [
  { start: null, links: [
    { keyword: 'أخبرنا', tx_kind: 'sama', name: 'محمد', status: 'ambiguous', candidates: [{ id: 1, name_ar: 'محمد بن علي', score: 0.6 }, { id: 2, name_ar: 'محمد بن عمر', score: 0.6 }] },
    { keyword: 'عن', tx_kind: null, name: 'أبيه', status: 'relative', candidates: [] },
    ...tail] },
  { start: null, links: [
    { keyword: 'حدثنا', tx_kind: 'sama', name: 'محمد بن عبد الكبير', status: 'matched', person_id: 5, reading_mode: 'heart', candidates: [] },
    { keyword: 'عن', tx_kind: null, name: 'أبيه', status: 'relative', candidates: [] },
    ...tail] },
];

test('one decision per name; relatives stay separate per occurrence', () => {
  const r = buildReview(PARSED);
  assert.equal(Object.keys(r.names).length, 6); // محمد, أبيه×2, إدريس, المؤلف, محمد بن عبد الكبير
  assert.equal(r.chains[0].links[2].key, r.chains[1].links[2].key);
  assert.notEqual(r.chains[0].links[1].key, r.chains[1].links[1].key);
});

test('default picks: matched → id, new → NEW, ambiguous/relative → unresolved', () => {
  const r = buildReview(PARSED);
  assert.deepEqual(unresolved(r).map(k => r.names[k].name), ['محمد', 'أبيه', 'أبيه']);
  assert.throws(() => toImportChains(r), /محمد، أبيه، أبيه/);
});

test('resolved review → import payload', () => {
  const r = buildReview(PARSED);
  unresolved(r).forEach((k, i) => { r.names[k].pick = [1, 3, NEW][i]; });
  const out = toImportChains(r);
  assert.deepEqual(out[0].links.map(l => l.person_id ?? l.new_name), [1, 3, 'إدريس العراقي', 9]);
  assert.deepEqual(out[1].links.map(l => l.person_id ?? l.new_name), [5, 'أبيه', 'إدريس العراقي', 9]);
  assert.equal(out[1].links[0].reading_mode, 'heart');
  assert.equal(out[0].links[0].tx_kind, 'sama');
  assert.equal(out[0].start, null);
});

test('pick options: new first, then candidates, then the rest without repeats', () => {
  const r = buildReview(PARSED);
  const entry = r.names[r.chains[0].links[0].key];
  const opts = pickOptions(entry, [{ id: 1, name_ar: 'محمد بن علي' }, { id: 7, name_ar: 'زيد', death_year: '100' }]);
  assert.deepEqual(opts.map(o => o.value), [NEW, 1, 2, 7]);
  assert.equal(opts[1].sub, 'تطابق 60%');
  assert.equal(opts[3].sub, 'ت 100');
});
