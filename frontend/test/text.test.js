import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, matches, countLabel } from '../src/utils/text.js';

test('normalizeArabic strips tashkeel and unifies letter variants', () => {
  assert.equal(normalizeArabic('إِبْرَاهِيمُ'), 'ابراهيم');
  assert.equal(normalizeArabic('مُصْطَفَى'), 'مصطفي');
  assert.equal(normalizeArabic('فاطمة'), 'فاطمه');
});

test('matches is forgiving across hamza forms and fields', () => {
  assert.ok(matches('احمد', 'أحمد بن حنبل'));
  assert.ok(matches('ibn', 'ابن حجر', 'Ibn Hajar'));
  assert.ok(matches('', 'anything'));
  assert.ok(!matches('مالك', 'الشافعي'));
});

test('countLabel uses Arabic dual and plural forms', () => {
  const forms = ['سند واحد', 'سندان', 'أسانيد', 'سنداً'];
  assert.equal(countLabel(1, forms), 'سند واحد');
  assert.equal(countLabel(2, forms), 'سندان');
  assert.equal(countLabel(5, forms), '5 أسانيد');
  assert.equal(countLabel(12, forms), '12 سنداً');
});

test('search finds a name with or without tashkeel, Quranic marks, pasted invisible marks or Persian letters', () => {
  assert.ok(matches('مُحَمَّدٌ', 'محمد'));
  assert.ok(matches('محمد', 'مُحَمَّدٌ'));
  assert.ok(matches('ذلك', 'ذَٰلِكَ'));
  assert.ok(matches('عليه', 'عليۖه'));
  assert.ok(matches('عبدالله', 'عبد‏الله'));
  assert.ok(matches('علي', 'علی'));
  assert.ok(matches('الكوفي', 'الکوفي'));
});

test('Arabic-Indic digits are kept and match Western ones', () => {
  assert.equal(normalizeArabic('ت ٨٥٢هـ'), 'ت 852ه'); // tatweel dropped too
  assert.ok(matches('852', 'ت ٨٥٢هـ'));
});
