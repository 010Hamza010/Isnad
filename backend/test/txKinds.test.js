const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../src/services/txKinds');

test('kinds are guessed from names in both the seed and a real database (eg.sql)', () => {
  const real = { 'بلفظ الشيخ': 'lafz', 'قراءة': 'qiraa', 'سماع': 'sama', 'إجازة': 'ijaza', 'مناولة': 'munawala', 'كتابة': 'kitaba',
    'إعلام': 'ilam', 'الوجادة': 'wijada', 'الوصية': 'wasiyya', 'الإجازة العامة': 'ijaza_general' };
  const seed = { 'قراءة على الشيخ': 'qiraa', 'إجازة عامة': 'ijaza_general', 'عرض': 'ard', 'قراءة عليه وأنا أسمع': 'sama_reading' };
  for (const [name, kind] of Object.entries({ ...real, ...seed })) assert.equal(K.kindFromName(name), kind, name);
  assert.equal(K.kindFromName('شيء آخر'), null);
});

test('an explicit kind wins over the name; edges use tx_kind / tx_name', () => {
  assert.equal(K.kindOf({ kind: 'sama', name_ar: 'قراءة' }), 'sama');
  assert.equal(K.kindOf({ kind: 'nonsense', name_ar: 'قراءة' }), 'qiraa');
  assert.equal(K.kindOf({ tx_name: 'الإجازة العامة' }), 'ijaza_general');
});

test('ranking: لفظ > سماع/قراءة/عرض > قراءة عليه وأنا أسمع > … > إجازة > … > إجازة عامة > untyped', () => {
  const r = K.rankOf;
  assert.ok(r('lafz') < r('sama'));
  assert.equal(r('sama'), r('qiraa'));
  assert.ok(r('qiraa') < r('sama_reading'));
  assert.ok(r('sama_reading') < r('ijaza'));
  assert.ok(r('ijaza') < r('ijaza_general'));
  assert.ok(r('wijada') < r(null));
});
