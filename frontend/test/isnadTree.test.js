import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutTree, shortBio, wrapText, txCategory, inDegrees } from '../src/utils/isnadTree.js';

const e = (f, t, name, death) => ({ from_person_id: f, to_person_id: t, to_name: name, to_death_year: death });

test('levels follow the longest path from me; shared persons appear once', () => {
  // me → 1 → 2 → 9 ; me → 3 → 9
  const { nodes, edges, maxLevel } = layoutTree([[e(0, 1, 'أ'), e(1, 2, 'ب'), e(2, 9, 'ي')], [e(0, 3, 'ج'), e(3, 9, 'ي')]]);
  const level = Object.fromEntries(nodes.map(n => [n.id, n.level]));
  assert.deepEqual(level, { 0: 0, 1: 1, 2: 2, 9: 3, 3: 1 });
  assert.equal(maxLevel, 3);
  assert.equal(nodes.filter(n => n.id === 9).length, 1);
  assert.equal(edges.length, 5);
});

test('rows are centered and ordered to follow their parents', () => {
  const { nodes, width } = layoutTree([[e(0, 1, 'أ'), e(1, 3, 'ج')], [e(0, 2, 'ب'), e(2, 4, 'د')]]);
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  assert.equal(width, 2);
  assert.deepEqual([by[1].order, by[2].order].sort(), [-0.5, 0.5]);
  assert.equal(Math.sign(by[3].order), Math.sign(by[1].order)); // child of أ stays on أ's side
});

test('cycles in bad data do not hang', () => {
  const r = layoutTree([[e(0, 1, 'أ'), e(1, 2, 'ب'), e(2, 1, 'أ')]]);
  assert.ok(r.nodes.length === 3);
});

test('shortBio keeps short text and cuts long text at a sentence boundary', () => {
  assert.equal(shortBio('قصير'), 'قصير');
  const long = 'جملة أولى طويلة نسبياً. ' + 'كلام '.repeat(80);
  assert.equal(shortBio(long, 40), 'جملة أولى طويلة نسبياً…');
  // a sentence end in the first half would make the note too short: cut at a word instead
  assert.match(shortBio(long, 60), /^جملة أولى طويلة نسبياً\. كلام.*كلام…$/);
});

test('wrapText wraps on words and never cuts a long word', () => {
  const measure = t => t.length; // 1 unit per char
  assert.deepEqual(wrapText('محمد عبد الحي الكتاني', 9, measure), ['محمد عبد', 'الحي', 'الكتاني']);
  assert.deepEqual(wrapText('سيبويهالطويلجدا', 5, measure), ['سيبويهالطويلجدا']);
  assert.deepEqual(wrapText('', 5, measure), ['']);
});

test('txCategory: by kind first, by name for older snapshots', () => {
  assert.equal(txCategory('lafz'), 'sama');
  assert.equal(txCategory('sama_reading'), 'qiraa');
  assert.equal(txCategory('ijaza_general'), 'ijaza');
  assert.equal(txCategory('سماع'), 'sama');
  assert.equal(txCategory('قراءة على الشيخ'), 'qiraa');
  assert.equal(txCategory('قراءة عليه وأنا أسمع'), 'qiraa');
  assert.equal(txCategory('إجازة عامة'), 'ijaza');
  assert.equal(txCategory('عرض'), 'ard');
  assert.equal(txCategory(null), 'other');
});

test('inDegrees counts students meeting at a person', () => {
  const d = inDegrees([{ from: 1, to: 9 }, { from: 2, to: 9 }, { from: 9, to: 10 }]);
  assert.equal(d.get(9), 2);
  assert.equal(d.get(10), 1);
});
