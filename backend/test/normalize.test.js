const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeArabic, keyOf } = require('../src/services/isnadText/normalize');

test('names match across tashkeel, Quranic marks, invisible marks, Persian letters and digits', () => {
  assert.equal(normalizeArabic('مُحَمَّدُ بْنُ الجَزَرِيِّ'), normalizeArabic('محمد بن الجزري'));
  assert.equal(normalizeArabic('عبد‏الله'), 'عبدالله');
  assert.equal(normalizeArabic('علی الکوفي'), 'علي الكوفي');
  assert.equal(normalizeArabic('٨٣٣'), '833');
});

test('keyOf strips the same marks but keeps ى apart from ي', () => {
  assert.equal(keyOf('عَلَى‏'), 'على');
  assert.notEqual(keyOf('على'), keyOf('علي'));
});
