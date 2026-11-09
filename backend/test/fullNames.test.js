const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fullName, inflect, caseAfter } = require('../src/services/isnadText/names');
const T = require('../src/services/isnadText');

test('kunya before the name, nisba after it', () => {
  assert.equal(fullName({ name: 'الإمام البخاري', kunya: 'أبو عبد الله', nisba: 'البخاري' }), 'أبو عبد الله الإمام البخاري');
  assert.equal(fullName({ name: 'علي بن حمزة الكسائي', kunya: 'أبو الحسن', nisba: 'الكوفي' }), 'أبو الحسن علي بن حمزة الكسائي الكوفي');
  assert.equal(fullName({ name: 'حفص', kunya: null, nisba: null }), 'حفص');
});

test('nothing the name already holds is repeated (real data shapes)', () => {
  // kunya already in the name, in another case
  assert.equal(fullName({ name: 'أبو جعفر يزيد بن القعقاع', kunya: 'أبو جعفر', nisba: 'المدني' }), 'أبو جعفر يزيد بن القعقاع المدني');
  assert.equal(fullName({ name: 'أبي الحسن علي بن محمد بن الحسن بن بري', kunya: 'بن بري', nisba: 'الرباطي' }, 'gen'),
    'أبي الحسن علي بن محمد بن الحسن بن بري الرباطي');
  // a laqab stored as kunya goes after the name; multi-word nisba keeps only new words
  assert.equal(fullName({ name: 'أبي وكيل ميمون', kunya: 'الفخار', nisba: 'المصمودي' }), 'أبو وكيل ميمون الفخار المصمودي');
  assert.equal(fullName({ name: 'محمد الشريف التلمساني', nisba: 'المري التلمساني الحسني' }), 'محمد الشريف التلمساني المري الحسني');
});

test('the leading kunya follows the case; inner «بن أبي» does not', () => {
  assert.equal(inflect('أبو عمرو بن العلاء', 'gen'), 'أبي عمرو بن العلاء');
  assert.equal(inflect('أبي عبدالله محمد', 'nom'), 'أبو عبدالله محمد');
  assert.equal(inflect('نافع بن أبي نعيم', 'nom'), 'نافع بن أبي نعيم');
  assert.equal(inflect('أم هانئ', 'gen'), 'أم هانئ');
});

test('case comes from the word before the name', () => {
  assert.equal(caseAfter('عن'), 'gen');
  assert.equal(caseAfter('قرأتُ على '), 'gen');
  assert.equal(caseAfter('وهو سمع من'), 'gen');
  assert.equal(caseAfter('أخبرنا'), 'nom');
  assert.equal(caseAfter(''), 'nom');
});

const P = {
  1: { name: 'محمد بن علي', kunya: 'أبو عبد الله', nisba: 'الفاسي' },
  2: { name: 'أبو عمرو الداني', kunya: 'أبو عمرو', nisba: 'الأندلسي' },
  3: { name: 'الشاطبي', kunya: 'أبو القاسم', nisba: null },
};
const edge = (from, to, tx_kind) => ({
  from_person_id: from, from_name: P[from]?.name, from_kunya: P[from]?.kunya, from_nisba: P[from]?.nisba,
  to_person_id: to, to_name: P[to].name, to_kunya: P[to].kunya, to_nisba: P[to].nisba, tx_kind,
});
const chain = [edge(0, 1, 'sama'), edge(1, 3, null), edge(3, 2, null)];

test('render: full names only with style.fullNames, in the right case', () => {
  const settings = T.mergeSettings(null);
  assert.equal(T.renderChains([chain], settings), 'حدثنا شيخنا محمد بن علي، عن الشاطبي، عن أبو عمرو الداني');
  const full = { ...settings, style: { ...settings.style, fullNames: true } };
  const ctx = T.newContext();
  const text = T.renderChains([chain], full, ctx);
  assert.equal(text, 'حدثنا شيخنا أبو عبد الله محمد بن علي الفاسي، عن أبي القاسم الشاطبي، عن أبي عمرو الداني الأندلسي');
  assert.ok(ctx.names.has('أبي القاسم الشاطبي'));
});

test('render: clear sentences put the kunya in the genitive after «على / من»', () => {
  const s = T.mergeSettings(null);
  const full = { ...s, style: { ...s.style, fullNames: true, clear: true } };
  const text = T.renderChains([[edge(0, 1, 'qiraa'), edge(1, 3, 'sama')]], full);
  assert.match(text, /قرأتُ على شيخنا أبي عبد الله محمد بن علي الفاسي/);
  assert.match(text, /من أبي القاسم الشاطبي/);
});
