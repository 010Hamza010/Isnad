import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roleMatcher, toAtoms, bodyToParagraphs, numberNotes, chainNames, designVars } from '../src/utils/certificate.js';

const m = roleMatcher({ student: 'أحمد بن علي', shaykh: 'الفقير فلان', names: ['جعفر الكتاني', 'محمد بن جعفر الكتاني'], sacred: ['النبي ﷺ'] });
const brief = atoms => atoms.map(a => (a.type === 'role' ? `${a.role}:${a.text}` : a.type === 'word' ? a.text : a.type === 'note' ? `#${a.id}` : a.type));

test('roles are matched longest-first and never split; death dates are a role', () => {
  const atoms = toAtoms('قرأ أحمد بن علي على محمد بن جعفر الكتاني (ت 1345هـ)[[3]]، وهو عن جعفر الكتاني', m);
  assert.deepEqual(brief(atoms), ['قرأ', 'student:أحمد بن علي', 'على', 'name:محمد بن جعفر الكتاني',
    'death:(ت 1345هـ)', '#3', '،', 'وهو', 'عن', 'name:جعفر الكتاني']);
});

test('ح and placeholders are atoms; spacing is preserved from the source', () => {
  const atoms = toAtoms('عن فلان ح وعن {المجيز}', m);
  assert.deepEqual(brief(atoms), ['عن', 'فلان', 'tahwil', 'وعن', 'placeholder']);
  assert.deepEqual(atoms.map(a => a.space), [true, true, true, true, false]);
  const tight = toAtoms('النبي ﷺ،', m);
  assert.deepEqual(brief(tight), ['sacred:النبي ﷺ', '،']);
  assert.equal(tight[0].space, false);
});

test('paragraphs split on blank lines; notes are numbered in reading order, once', () => {
  const paras = bodyToParagraphs('أ[[5]] ب\n\nج[[2]] د[[5]] هـ[[9]]', m);
  assert.equal(paras.length, 2);
  assert.deepEqual([...numberNotes(paras, { 5: {}, 2: {} }).entries()], [[5, 1], [2, 2]]);
});

test('chainNames separates sacred names and skips me', () => {
  const r = chainNames([[{ from_person_id: 0, from_name: 'أنا', to_person_id: 1, to_name: 'أ' }, { from_person_id: 1, to_person_id: -1, to_name: 'النبي ﷺ' }]]);
  assert.deepEqual(r, { names: ['أ'], sacred: ['النبي ﷺ'] });
});

test('designVars exposes colors, fonts, sizes and page metrics', () => {
  const v = designVars({ colors: { paper: '#fff' }, fonts: { body: { family: 'Amiri', size: 15 } }, frame: { marginMm: 9, paddingMm: 18 }, boldNames: true });
  assert.equal(v['--c-paper'], '#fff');
  assert.equal(v['--s-body'], '15pt');
  assert.match(v['--f-body'], /^"Amiri"/);
  assert.equal(v['--page-margin'], '9mm');
});
