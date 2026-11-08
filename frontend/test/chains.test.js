import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitChains, commonSuffix } from '../src/utils/chains.js';

const e = (from, to) => ({ from_person_id: from, to_person_id: to });
const ids = edges => edges.map(x => x.to_person_id);

test('single chain is all prefix', () => {
  const r = splitChains([[e(1, 2), e(2, 3)]]);
  assert.deepEqual(ids(r.prefix), [2, 3]);
  assert.deepEqual(r.branches, []);
});

test('fork then re-join: shared prefix, two branches, shared suffix', () => {
  const a = [e(1, 2), e(2, 3), e(3, 9), e(9, 10)];
  const b = [e(1, 2), e(2, 4), e(4, 9), e(9, 10)];
  const r = splitChains([a, b]);
  assert.deepEqual(ids(r.prefix), [2]);
  assert.deepEqual(r.branches.map(ids), [[3], [4]]);
  assert.deepEqual(ids(r.suffix), [9, 10]);
});

test('branch that is fully absorbed by suffix is dropped (no empty boxes)', () => {
  const a = [e(1, 9)];
  const b = [e(1, 5), e(5, 9)];
  const r = splitChains([a, b]);
  assert.deepEqual(r.branches.map(ids), [[5]]);
  assert.deepEqual(ids(r.suffix), [9]);
});

test('commonSuffix of empty list', () => {
  assert.deepEqual(commonSuffix([]), []);
});
