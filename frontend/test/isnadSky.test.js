import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyLayout, wasaitText } from '../src/utils/isnadSky.js';

const e = (from, to) => ({ from_person_id: from, to_person_id: to });
const persons = [1, 2, 3, 4, 9].map(id => ({ id, name_ar: `p${id}` }));

test('persons sit at their fewest links from me; unreachable ones are left out', () => {
  const sky = skyLayout({ persons, matnEdges: [e(0, 1), e(1, 2), e(2, 3), e(0, 2), e(4, 9)], quranEdges: [e(3, -1)] });
  const by = Object.fromEntries(sky.nodes.map(n => [n.id, n]));
  assert.deepEqual(sky.nodes.map(n => [n.id, n.depth]), [[0, 0], [1, 1], [2, 1], [3, 2], [-1, 3]]);
  assert.equal(by[4], undefined);
  assert.equal(by[9], undefined);
  assert.equal(sky.height, 3);
  assert.deepEqual([by[0].kind, by[1].kind, by[3].kind, by[-1].kind], ['me', 'shaykh', 'person', 'sacred']);
  assert.equal(by[0].name, 'أنا');
  assert.equal(by[-1].name, 'النبي ﷺ');
  assert.equal(by[3].y, 2);
});

test('links only go upwards, once per pair, with matn and Quran links merged', () => {
  const sky = skyLayout({ persons, matnEdges: [e(0, 1), e(0, 1), e(1, 2), e(0, 2)], quranEdges: [e(0, 1)] });
  const ids = sky.links.map(([a, b]) => [sky.nodes[a].id, sky.nodes[b].id]);
  // 1 → 2 is not upwards (both at depth 1): left out
  assert.deepEqual(ids.sort(), [[0, 1], [0, 2]]);
});

test('the highest persons are marked «top» and persons of one layer are spread on a ring', () => {
  const sky = skyLayout({ persons, matnEdges: [e(0, 1), e(1, 2), e(1, 3), e(1, 4)], quranEdges: [] });
  const layer2 = sky.nodes.filter(n => n.depth === 2);
  assert.deepEqual(layer2.map(n => n.kind), ['top', 'top', 'top']);
  const radii = layer2.map(n => Math.hypot(n.x, n.z).toFixed(6));
  assert.equal(new Set(radii).size, 1);
  assert.equal(new Set(layer2.map(n => `${n.x.toFixed(3)},${n.z.toFixed(3)}`)).size, 3);
});

test('no links: only me', () => {
  const sky = skyLayout({ persons, matnEdges: [], quranEdges: [] });
  assert.deepEqual(sky.nodes.map(n => n.kind), ['me']);
  assert.deepEqual(sky.links, []);
  assert.equal(sky.height, 0);
  assert.deepEqual(skyLayout(null).nodes.length, 1);
});

test('Arabic count of wasait', () => {
  assert.deepEqual([0, 1, 2, 3, 10, 11, 27].map(wasaitText),
    ['بلا واسطة', 'واسطة واحدة', 'واسطتان', '3 وسائط', '10 وسائط', '11 واسطة', '27 واسطة']);
});
