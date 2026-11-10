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

import { routeTree, numberRoutes, isGeneralRoute } from '../src/utils/chains.js';

// the screenshot case: routes 2 and 3 share a long start, differ by one person, then share the tail
test('routeTree splits again inside a fork (nested) and keeps the shared tail once', () => {
  const r1 = [e(1, 2), e(2, 3), e(3, 99)];
  const r2 = [e(1, 10), e(10, 11), e(11, 12), e(12, 13), e(13, 99)];
  const r3 = [e(1, 10), e(10, 11), e(11, 13), e(13, 99)];
  const t = routeTree([r1, r2, r3], [1, 2, 3], 2);
  assert.deepEqual(t.prefix, []);
  assert.deepEqual(t.suffix.map(s => s.edge.to_person_id), [99]);
  assert.deepEqual(t.suffix[0].depths, [4, 5, 6]);
  assert.deepEqual(t.forks.map(f => f.routes), [[1], [2, 3]]);
  const inner = t.forks[1].tree;
  assert.deepEqual(inner.prefix.map(s => [s.edge.to_person_id, s.depths]), [[10, [2]], [11, [3]]]);
  assert.deepEqual(inner.forks.map(f => [f.routes, f.tree && ids(f.tree.prefix.map(s => s.edge))]), [[[2], [12]], [[3], null]]);
  assert.deepEqual(inner.suffix.map(s => [s.edge.to_person_id, s.depths]), [[13, [4, 5]]]);
});

test('routeTree: one route is a plain numbered run', () => {
  const t = routeTree([[e(1, 2), e(2, 3)]], [4], 2);
  assert.deepEqual(t.prefix.map(s => s.depths), [[2], [3]]);
  assert.deepEqual(t.forks, []);
});

test('numberRoutes orders the highest (shortest) first and keeps keys', () => {
  const g = { chains: [[e(1, 2), e(2, 9)], [e(1, 9)]], keys: ['a', 'b'] };
  assert.deepEqual(numberRoutes(g).map(r => [r.key, r.n]), [['b', 2], ['a', 3]]);
  assert.deepEqual(numberRoutes(g, 'entry').map(r => r.key), ['a', 'b']);
});

test('isGeneralRoute: only my own link to my shaykh makes a route general', () => {
  assert.equal(isGeneralRoute(e(0, 1)), false);
  assert.equal(isGeneralRoute({ ...e(0, 1), general: true }), true);
  assert.equal(isGeneralRoute(e(0, 1), [{ ...e(1, 9), general: true }]), false, 'a general link higher up is only a scope');
});
