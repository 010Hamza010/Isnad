import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoNetwork, loginSky, seeded } from '../src/utils/loginSky.js';

test('the seeded generator repeats', () => {
  const a = seeded(3), b = seeded(3);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.ok(xs.every(x => x >= 0 && x < 1));
});

test('the demo network is the same on every visit', () => {
  assert.deepEqual(demoNetwork(), demoNetwork());
  assert.notDeepEqual(demoNetwork({ seed: 1 }), demoNetwork({ seed: 2 }));
});

test('every person is reached from me and the network converges on one star at the top', () => {
  const sky = loginSky({ depth: 9 });
  assert.equal(sky.height, 9);
  const top = sky.nodes.filter(n => n.depth === 9);
  assert.equal(top.length, 1);
  assert.equal(sky.nodes.filter(n => n.kind === 'me').length, 1);
  // all generated persons are laid out (none unreachable)
  const ids = new Set(demoNetwork({ depth: 9 }).matnEdges.flatMap(e => [e.from_person_id, e.to_person_id]));
  assert.equal(sky.nodes.length, ids.size);
  // each person above me has a thread coming up to him
  const reached = new Set(sky.links.map(([, b]) => b));
  sky.nodes.forEach((n, i) => { if (n.depth > 0) assert.ok(reached.has(i), `node ${n.id}`); });
});
