import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeGraph, stepsFromMe, numbered } from '../src/utils/routeGraph.js';

const e = (from, to, extra = {}) => ({ from_person_id: from, to_person_id: to, to_name: `p${to}`, ...extra });

test('routes are numbered per group, links know their routes, persons their orders', () => {
  const paths = [
    { firstEdge: e(0, 1), chains: [[e(1, 2), e(2, 9)], [e(1, 9, { general: true })]], keys: ['0.1.2.9', '0.1.9'] },
    { firstEdge: e(0, 3), chains: [[e(3, 9)]], keys: ['0.3.9'] },
  ];
  const g = routeGraph(paths, [{ key: '0.4.9', names: ['p4', 'p9'] }]);
  assert.deepEqual(g.routes.map(r => [r.label, r.key, r.n, r.general]), [['1.1', '0.1.9', 2, true], ['1.2', '0.1.2.9', 3, false], ['2.1', '0.3.9', 2, false]]);
  const link = (f, t) => g.edges.find(x => x.from === f && x.to === t);
  assert.deepEqual(link(0, 1).routes, ['1.1', '1.2']);
  assert.equal(link(1, 9).general, true);
  assert.deepEqual([...g.depths.get(9)].sort(), [2, 3]);
  assert.equal(link(0, 4).off, true);
  assert.equal(link(0, 1).off, false);
  assert.equal(g.names.get(4), 'p4');
});

test('stepsFromMe is the shortest order, numbered prefixes the name', () => {
  const s = stepsFromMe([{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 0, to: 2 }, { from: 2, to: 3 }]);
  assert.deepEqual([...s.entries()], [[0, 0], [1, 1], [2, 1], [3, 2]]);
  assert.equal(numbered('فلان', new Set([3, 2])), '2/3 · فلان');
  assert.equal(numbered('فلان', null), 'فلان');
});
