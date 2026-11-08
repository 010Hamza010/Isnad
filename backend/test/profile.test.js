const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/services/profile');

test('until saved, the profile is taken from the older per-feature settings', () => {
  const p = P.mergeProfile(null, { ijaza: { shaykh_name: 'حمزة بن محمود بن علي', shaykh_gender: 'M', place: 'فاس' }, isnad: { style: { myGender: 'F' } } });
  assert.deepEqual(p, { full_name: 'حمزة بن محمود بن علي', short_name: '', gender: 'M', place: 'فاس' });
  assert.equal(P.mergeProfile(null, { isnad: { style: { myGender: 'F' } } }).gender, 'F');
});

test('a saved profile wins; short name falls back to the full name', () => {
  const p = P.mergeProfile({ full_name: 'حمزة بن محمود', short_name: 'حمزة شنتير' }, { ijaza: { shaykh_name: 'قديم' } });
  assert.equal(p.full_name, 'حمزة بن محمود');
  assert.equal(P.shortName(p), 'حمزة شنتير');
  assert.equal(P.shortName({ full_name: 'كامل', short_name: '' }), 'كامل');
});

test('validation trims, limits lengths and normalises gender', () => {
  const p = P.validateProfile({ full_name: '  أ  ', short_name: 'ب', gender: 'x', place: ' فاس ' });
  assert.deepEqual(p, { full_name: 'أ', short_name: 'ب', gender: 'M', place: 'فاس' });
  assert.throws(() => P.validateProfile({ short_name: 'x'.repeat(61) }), e => e.status === 400);
});
