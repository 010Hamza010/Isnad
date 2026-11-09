import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, readingPhrase, takhammulPhrase, formatDates, ijazaTitle, joinArabic, readingTeachers, teachersParagraph, applyGender } from '../src/utils/ijaza.js';
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
  assert.equal(takhammulPhrase('sama'), 'سمع مني');
  assert.equal(takhammulPhrase('qiraa'), 'قرأ عليّ');
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

test('optional placeholders vanish with their paragraph instead of being reported', () => {
  const r = fillTemplate('أ\n\n{شيوخ_القراءة}\n\nوإسنادي: {الإسناد}', { 'الإسناد': 'س' }, { optional: ['شيوخ_القراءة'] });
  assert.equal(r.text, 'أ\n\nوإسنادي: س');
  assert.deepEqual(r.missing, []);
});

test('joinArabic attaches و to every item after the first', () => {
  assert.equal(joinArabic(['أ', 'ب', 'ج']), 'أ، وب، وج');
  assert.equal(joinArabic(['أ']), 'أ');
});

// seed numbering for brevity → transmission kinds (what the API sends as tx_kind)
const KIND = { 1: 'sama', 2: 'qiraa', 9: 'ard' };
const conn = (to, name, tx, extra = {}) => ({ from_person_id: 0, to_person_id: to, to_name: name, tx_kind: KIND[tx] ?? null, ...extra });

test('readingTeachers (matn): only my قراءة/عرض connections for that matn, one per shaykh', () => {
  const conns = [
    conn(1, 'أ', 2, { matn_id: 7 }), conn(1, 'أ', 2, { matn_id: 7, reading_mode: 'heart' }),
    conn(2, 'ب', 2, { matn_id: 7 }), conn(3, 'ج', 1, { matn_id: 7 }),        // سماع: not «read on»
    conn(4, 'د', 2, { matn_id: 8 }), { ...conn(5, 'هـ', 2, { matn_id: 7 }), from_person_id: 9 },
  ];
  assert.deepEqual(readingTeachers(conns, 'mutoon', { matnId: 7 }),
    [{ id: 1, name: 'أ', gender: 'M', reading_mode: 'heart' }, { id: 2, name: 'ب', gender: 'M', reading_mode: null }]);
});

test('readingTeachers (quran): riwaya match, qiraa-level and unscoped connections count', () => {
  const conns = [
    conn(1, 'أ', 2, { items: [{ riwaya_id: 2 }] }),       // same riwaya
    conn(2, 'ب', 9, { items: [] }),                       // مطلق
    conn(3, 'ج', 2, { items: [{ qiraa_id: 1 }] }),        // whole qiraa
    conn(4, 'د', 2, { items: [{ riwaya_id: 5 }] }),       // other riwaya
  ];
  const r = readingTeachers(conns, 'quran', { option: { qiraa_id: 1, riwaya_id: 2 }, riwayaQiraa: () => 1 });
  assert.deepEqual(r.map(t => t.name), ['أ', 'ب', 'ج']);
});

test('teachersParagraph needs two or more shuyukh and adds the reading mode word', () => {
  const sentence = 'قرأتُه على جماعة، منهم: {الشيوخ}.';
  const words = { heart: 'غيباً من حفظي', looking: 'نظراً' };
  assert.equal(teachersParagraph([{ name: 'أ' }], sentence, words), '');
  assert.equal(teachersParagraph([{ name: 'أ', reading_mode: 'heart' }, { name: 'ب' }], sentence, words),
    'قرأتُه على جماعة، منهم: الشيخ أ غيباً من حفظي، والشيخ ب.');
  assert.equal(teachersParagraph([{ name: 'أ' }, { name: 'ب' }], sentence, words, ''), 'قرأتُه على جماعة، منهم: أ، وب.');
});

test('gender alternations follow the student (المجاز) and me (المجيز); unknown roles stay', () => {
  const tpl = '{المجاز:فأجزته|فأجزتها} {المجيز:وكتبه|وكتبته}: {المجيز} {أخرى:أ|ب}';
  const r = fillTemplate(tpl, { 'المجيز': 'فلانة' }, { genders: { 'المجاز': 'F', 'المجيز': 'F' } });
  assert.equal(r.text, 'فأجزتها وكتبته: فلانة {أخرى:أ|ب}');
  assert.equal(applyGender('{المجاز:قرأ|قرأت}', { 'المجاز': 'M' }), 'قرأ');
});

test('takhammulPhrase agrees with the student', () => {
  assert.equal(takhammulPhrase('qiraa', 'F'), 'قرأت عليّ');
  assert.equal(takhammulPhrase('sama', 'F'), 'سمعت مني');
  assert.equal(takhammulPhrase('unknown', 'F'), 'قرأت عليّ');
});

test('teachers paragraph uses «الشيخة» for women', () => {
  const p = teachersParagraph([{ name: 'نزهة', gender: 'F' }, { name: 'زيد', gender: 'M' }], 'منهم: {الشيوخ}.', {}, { M: 'الشيخ', F: 'الشيخة' });
  assert.equal(p, 'منهم: الشيخة نزهة، والشيخ زيد.');
});

test('title from the type template: optional reading, fallback while the matn is not chosen', async () => {
  const { titleFromTemplate } = await import('../src/utils/ijaza.js');
  assert.equal(titleFromTemplate({ text: 'إجازة بمتن «{المتن}» لـ{المؤلف}' }, 'mutoon', { 'المتن': 'الآجرومية', 'المؤلف': 'ابن آجروم' }),
    'إجازة بمتن «الآجرومية» لـابن آجروم');
  assert.equal(titleFromTemplate({ text: 'إجازة بمتن «{المتن}»' }, 'mutoon', {}), 'إجازة');
  assert.equal(titleFromTemplate({ text: 'إجازة في القرآن الكريم {القراءة_والرواية}' }, 'quran', { 'القراءة_والرواية': '' }), 'إجازة في القرآن الكريم');
  assert.equal(titleFromTemplate(null, 'general', {}), 'إجازة عامة');
});

test('title style overrides only what is set', async () => {
  const { withTitleStyle } = await import('../src/utils/ijaza.js');
  const d = { colors: { title: '#111111', text: '#000000' }, fonts: { title: { family: 'Amiri', size: 30 }, body: { family: 'Amiri', size: 15 } } };
  assert.deepEqual(withTitleStyle(d, {}).fonts.title, { family: 'Amiri', size: 30 });
  const s = withTitleStyle(d, { color: '#aa0000', family: 'Aref Ruqaa', size: 40 });
  assert.equal(s.colors.title, '#aa0000');
  assert.deepEqual(s.fonts.title, { family: 'Aref Ruqaa', size: 40 });
  assert.equal(s.colors.text, '#000000');
  assert.equal(d.colors.title, '#111111'); // not mutated
});

test('teacher order: key per matn / riwaya; saved order first, the rest after in their own order', async () => {
  const { teacherOrderKey, sortByOrder, orderablePeople, moveId } = await import('../src/utils/ijaza.js');
  assert.equal(teacherOrderKey('mutoon', { matnId: 52 }), 'm:52');
  assert.equal(teacherOrderKey('quran', { quranKey: 'q1-r2-tnull' }), 'q:q1-r2-tnull');
  assert.equal(teacherOrderKey('mutoon', {}), null);
  assert.equal(teacherOrderKey('general', { matnId: 1 }), null);

  const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(sortByOrder(items, [3, '1']).map(x => x.id), [3, 1, 2, 4]);
  assert.deepEqual(sortByOrder(items, [9]).map(x => x.id), [1, 2, 3, 4]); // unknown ids are ignored

  const groups = [
    { firstEdge: { to_person_id: 10, to_name: 'أ' } },
    { firstEdge: { to_person_id: 20, to_name: 'ب' } },
    { firstEdge: { to_person_id: 10, to_name: 'أ' } },
  ];
  const teachers = [{ id: 20, name: 'ب' }, { id: 30, name: 'ج' }]; // ج: read on him, but no connected route
  const people = orderablePeople(groups, teachers, [30, 20]);
  assert.deepEqual(people, [
    { id: 30, name: 'ج', routes: [], reads: true },
    { id: 20, name: 'ب', routes: [1], reads: true },
    { id: 10, name: 'أ', routes: [0, 2], reads: false },
  ]);
  assert.deepEqual(moveId(people, 2, -1), [30, 10, 20]);
  assert.deepEqual(moveId(people, 0, -1), [30, 20, 10]); // already first
});

test('a title template keeps its line breaks (long matn names on their own line)', async () => {
  const { titleFromTemplate } = await import('../src/utils/ijaza.js');
  assert.equal(titleFromTemplate({ text: 'إجازة في متن  \n «{المتن}»\n' }, 'mutoon', { 'المتن': 'المنظومة' }), 'إجازة في متن\n«المنظومة»');
});
