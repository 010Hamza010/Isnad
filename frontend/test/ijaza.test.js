import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, readingPhrase, takhammulPhrase, formatDates, ijazaTitle } from '../src/utils/ijaza.js';
import { quranOptions, quranPathParams, groupsToChains } from '../src/utils/quranOptions.js';

test('fillTemplate replaces known keys and reports missing ones', () => {
  const r = fillTemplate('قرأ {الطالب} متن «{المتن}» على {المجيز}', { 'الطالب': 'أحمد', 'المتن': 'الآجرومية', 'المجيز': '' });
  assert.equal(r.text, 'قرأ أحمد متن «الآجرومية» على {المجيز}');
  assert.deepEqual(r.missing, ['المجيز']);
});

test('fillTemplate leaves non-placeholder braces alone across lines', () => {
  assert.equal(fillTemplate('{\n}', {}).text, '{\n}');
});

test('readingPhrase adds رواية/قراءة/طريق only when missing', () => {
  assert.equal(readingPhrase({ riwaya: 'ورش عن نافع', tariq: 'طريق الأزرق' }), 'برواية ورش عن نافع من طريق الأزرق');
  assert.equal(readingPhrase({ qiraa: 'قراءة عاصم' }), 'بقراءة عاصم');
  assert.equal(readingPhrase({ riwaya: 'رواية حفص', tariq: 'الشاطبية' }), 'برواية حفص من طريق الشاطبية');
  assert.equal(readingPhrase({}), '');
});

test('takhammulPhrase maps transmission types with a sensible default', () => {
  assert.equal(takhammulPhrase(1), 'سمع مني');
  assert.equal(takhammulPhrase('2'), 'قرأ عليّ');
  assert.equal(takhammulPhrase(null), 'قرأ عليّ');
});

test('formatDates gives Hijri and Gregorian with Latin digits', () => {
  const d = formatDates('2026-11-08');
  assert.match(d.hijri, /1448هـ$/);
  assert.match(d.gregorian, /2026م$/);
  assert.deepEqual(formatDates('nope'), { gregorian: '', hijri: '' });
});

test('ijazaTitle per module', () => {
  assert.equal(ijazaTitle('mutoon', { matn: 'الآجرومية' }), 'إجازة في متن «الآجرومية»');
  assert.equal(ijazaTitle('quran', { reading: 'برواية ورش' }), 'إجازة في القرآن الكريم برواية ورش');
  assert.equal(ijazaTitle('general'), 'إجازة عامة');
});

test('quranOptions groups my riwayat by qiraa and collects teachers', () => {
  const lookups = {
    qiraat: [{ id: 1, name_ar: 'قراءة نافع' }],
    riwayat: [{ id: 2, name_ar: 'ورش عن نافع', qiraa_id: 1 }],
    turuq: [],
  };
  const conns = [
    { from_person_id: 0, to_name: 'الشيخ أ', items: [{ riwaya_id: 2 }] },
    { from_person_id: 0, to_name: 'الشيخ ب', items: [{ riwaya_id: 2 }] },
    { from_person_id: 0, to_name: 'الشيخ ج', items: [] },
    { from_person_id: 9, to_name: 'غيري', items: [{ riwaya_id: 2 }] },
  ];
  const groups = quranOptions(conns, lookups);
  assert.deepEqual(groups.map(([label, opts]) => [label, opts.map(o => o.teachers)]),
    [['قراءة نافع', [['الشيخ أ', 'الشيخ ب']]], ['مطلق', [['الشيخ ج']]]]);
  assert.equal(quranPathParams(groups[0][1][0]), 'riwaya_id=2');
});

test('groupsToChains prepends the first edge and keeps direct links', () => {
  const f = { to_person_id: 1 };
  assert.deepEqual(groupsToChains([{ firstEdge: f, chains: [[{ to_person_id: 2 }]] }, { firstEdge: f, chains: [] }]),
    [[f, { to_person_id: 2 }], [f]]);
});
