import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, readingPhrase, groupReading, takhammulPhrase, formatDates, ijazaTitle, joinArabic, readingTeachers, readOnLink, readOnShaykh, withReads, teachersParagraph, applyGender } from '../src/utils/ijaza.js';
import { quranOptions, quranGroupOptions, quranPathParams, groupsToChains } from '../src/utils/quranOptions.js';

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

test('quranOptions: what my links name, a whole qiraa split into its riwayat, one entry per tariq', () => {
  const lookups = {
    qiraat: [{ id: 1, name_ar: 'قراءة نافع' }, { id: 5, name_ar: 'قراءة عاصم' }, { id: 9, name_ar: 'قراءة بلا روايات' }],
    riwayat: [{ id: 2, name_ar: 'رواية ورش', qiraa_id: 1 }, { id: 6, name_ar: 'رواية شعبة', qiraa_id: 5 }, { id: 7, name_ar: 'رواية حفص', qiraa_id: 5 }],
    turuq: [{ id: 3, name_ar: 'الأزرق', riwaya_id: 2 }, { id: 4, name_ar: 'الأصبهاني', riwaya_id: 2 }],
  };
  const conns = [
    { from_person_id: 0, to_name: 'الشيخ أ', items: [{ riwaya_id: 2 }] },
    { from_person_id: 0, to_name: 'الشيخ ب', items: [{ riwaya_id: 2 }] },               // same entry as أ
    { from_person_id: 0, to_name: 'الشيخ ج', items: [{ riwaya_id: 2, tariq_id: 4 }] },  // its own entry
    { from_person_id: 0, to_name: 'الشيخ د', items: [{ qiraa_id: 5 }] },                // → شعبة and حفص
    { from_person_id: 0, to_name: 'الشيخ هـ', items: [{ qiraa_id: 9 }] },
    { from_person_id: 0, to_name: 'الشيخ و', items: [] },                               // names nothing
    { from_person_id: 9, to_name: 'غيري', items: [{ riwaya_id: 2 }] },
  ];
  const groups = quranOptions(conns, lookups);
  assert.deepEqual(groups.map(([label, opts]) => [label, opts.map(o => [o.riwayaLabel, o.tariqLabel, o.teachers.join('+')])]), [
    ['قراءة نافع', [['رواية ورش', null, 'الشيخ أ+الشيخ ب'], ['رواية ورش', 'الأصبهاني', 'الشيخ ج']]],
    ['قراءة عاصم', [['رواية شعبة', null, 'الشيخ د'], ['رواية حفص', null, 'الشيخ د']]],
    ['قراءة بلا روايات', [[null, null, 'الشيخ هـ']]],
  ]);
  assert.equal(quranPathParams(groups[0][1][0]), 'riwaya_id=2&tariq_id=0');
  assert.equal(quranPathParams(groups[0][1][1]), 'riwaya_id=2&tariq_id=4');
  assert.equal(quranPathParams(groups[2][1][0]), 'qiraa_id=9');
});

test('quranOptions: a link read with a group counts as its members', () => {
  const lookups = {
    qiraat: [{ id: 5, name_ar: 'قراءة عاصم' }], riwayat: [{ id: 6, name_ar: 'رواية شعبة', qiraa_id: 5 }, { id: 7, name_ar: 'رواية حفص', qiraa_id: 5 }],
    turuq: [], groups: [{ id: 3, items: [{ qiraa_id: 5, riwaya_id: null }] }],
  };
  const groups = quranOptions([{ from_person_id: 0, to_name: 'الشيخ د', items: [], groups: [{ group_id: 3 }] }], lookups);
  assert.deepEqual(groups[0][1].map(o => o.riwayaLabel), ['رواية شعبة', 'رواية حفص']);
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

test('readingTeachers (quran): a group option takes the links read with it; a link\'s groups count as their members', () => {
  const groups = [{ id: 3, items: [{ qiraa_id: 1 }] }];
  const conns = [
    conn(1, 'أ', 2, { items: [], groups: [{ group_id: 3 }] }),   // read with the group
    conn(2, 'ب', 2, { items: [{ riwaya_id: 2 }] }),              // a riwaya only
    conn(3, 'ج', 2, { items: [], groups: [{ group_id: 4 }] }),   // another group (unknown members)
  ];
  assert.deepEqual(readingTeachers(conns, 'quran', { option: { group_id: 3 }, groups }).map(t => t.name), ['أ']);
  // riwaya 2 of qiraa 1: the group's qiraa covers it; a link of another group does not count as «مطلق»
  assert.deepEqual(readingTeachers(conns, 'quran', { option: { qiraa_id: 1, riwaya_id: 2 }, riwayaQiraa: () => 1, groups }).map(t => t.name), ['أ', 'ب']);
});

test('quranGroupOptions: the groups my links were read with, their books once, their teachers', () => {
  const groups = [{ id: 3, name_ar: 'العشر الصغرى', text_ar: 'القراءات العشر الصغرى' }, { id: 4, name_ar: 'الحرميان', text_ar: null }];
  const conns = [
    { from_person_id: 0, to_name: 'أ', groups: [{ group_id: 3 }], books: [{ matn_id: 1, title: 'الشاطبية' }, { matn_id: 2, title: 'الدرة' }] },
    { from_person_id: 0, to_name: 'ب', groups: [{ group_id: 3 }, { group_id: 4 }], books: [{ matn_id: 1, title: 'الشاطبية' }] },
    { from_person_id: 5, to_name: 'ج', groups: [{ group_id: 4 }] },   // not mine
  ];
  const opts = quranGroupOptions(conns, groups);
  assert.deepEqual(opts.map(o => o.key), ['g4', 'g3']);
  const ten = opts.find(o => o.key === 'g3');
  assert.equal(ten.groupText, 'القراءات العشر الصغرى');
  assert.deepEqual(ten.books.map(b => b.title), ['الشاطبية', 'الدرة']);
  assert.deepEqual(ten.teachers, ['أ', 'ب']);
  assert.equal(opts.find(o => o.key === 'g4').groupText, 'الحرميان');
});

test('groupReading: «ب» + the group text, with its books «بمضمن»', () => {
  assert.equal(groupReading({ text: 'القراءات العشر الصغرى' }), 'بالقراءات العشر الصغرى');
  assert.equal(groupReading({ text: 'القراءات العشر الصغرى', books: [{ title: 'الشاطبية' }, { title: 'الدرة' }] }),
    'بالقراءات العشر الصغرى بمضمن الشاطبية والدرة');
  assert.equal(groupReading({}), '');
});

// qiraat 1 عاصم (riwayat 11 حفص، 12 شعبة), 2 نافع (21 قالون); tariq 5 of حفص; groups 3 الصغرى (عاصم + نافع), 4 الحرميان (نافع)
const L = {
  qiraat: [{ id: 1, name_ar: 'قراءة عاصم' }, { id: 2, name_ar: 'قراءة نافع' }],
  riwayat: [{ id: 11, qiraa_id: 1, name_ar: 'رواية حفص' }, { id: 12, qiraa_id: 1, name_ar: 'رواية شعبة' }, { id: 21, qiraa_id: 2, name_ar: 'رواية قالون' }],
  turuq: [{ id: 5, riwaya_id: 11, name_ar: 'طريق عبيد' }],
  groups: [{ id: 3, name_ar: 'الصغرى', text_ar: 'القراءات العشر الصغرى', items: [{ qiraa_id: 1 }, { qiraa_id: 2 }] },
    { id: 4, name_ar: 'الحرميان', text_ar: 'قراءة الحرميين', items: [{ qiraa_id: 2 }] }],
};
const HAFS = { qiraa_id: 1, riwaya_id: 11 };

test('readOnLink: the link\'s own words, only what concerns the choice, a group first', () => {
  assert.equal(readOnLink({ items: [{ qiraa_id: 1 }, { qiraa_id: 2 }] }, HAFS, L), 'بقراءة عاصم');            // not نافع, not حفص
  assert.equal(readOnLink({ items: [{ riwaya_id: 11 }] }, HAFS, L), 'برواية حفص عن عاصم');
  assert.equal(readOnLink({ items: [{ tariq_id: 5 }] }, HAFS, L), 'برواية حفص عن عاصم من طريق عبيد');
  assert.equal(readOnLink({ items: [{ qiraa_id: 2 }], groups: [{ group_id: 3 }] }, HAFS, L), 'بالقراءات العشر الصغرى');
  assert.equal(readOnLink({ items: [{ qiraa_id: 1 }], groups: [{ group_id: 4 }] }, HAFS, L), 'بقراءة عاصم');   // الحرميان has no حفص
  assert.equal(readOnLink({ items: [{ riwaya_id: 12 }] }, HAFS, L), '');                                         // شعبة only
  assert.equal(readOnLink({ is_general: 1, items: [] }, HAFS, L), '');                                         // «عام»: plain
  assert.equal(readOnLink({ auto: true }, HAFS, L), '');
});

test('readOnLink in a group ijaza: the group, or the members the link names', () => {
  const G = { group_id: 3 };
  assert.equal(readOnLink({ groups: [{ group_id: 3 }] }, G, L), 'بالقراءات العشر الصغرى');
  assert.equal(readOnLink({ items: [{ qiraa_id: 1 }, { qiraa_id: 2 }] }, G, L), 'بالقراءات العشر الصغرى');
  assert.equal(readOnLink({ items: [{ qiraa_id: 2 }] }, G, L), 'بقراءة نافع');
});

test('withReads: every level, «بها» when the same as the level below, nothing on «عام»', () => {
  const chain = [
    { from_person_id: 0, to_person_id: 1, items: [{ qiraa_id: 1 }] },
    { from_person_id: 1, to_person_id: 2, items: [{ qiraa_id: 1 }] },
    { from_person_id: 2, to_person_id: 3, items: [], groups: [{ group_id: 3 }] },
    { from_person_id: 3, to_person_id: 4, is_general: 1, items: [] },
    { from_person_id: 4, to_person_id: 5, items: [{ qiraa_id: 1 }] },
  ];
  assert.deepEqual(withReads([chain], HAFS, L)[0].map(e => e.read_with), ['بقراءة عاصم', 'بها', 'بالقراءات العشر الصغرى', undefined, 'بقراءة عاصم']);
});

test('readOnShaykh: a link holding a group first', () => {
  assert.equal(readOnShaykh([{ items: [{ qiraa_id: 1 }] }, { items: [], groups: [{ group_id: 3 }] }], HAFS, L), 'بالقراءات العشر الصغرى');
  assert.equal(readOnShaykh([{ items: [{ qiraa_id: 1 }, { qiraa_id: 2 }] }], HAFS, L), 'بقراءة عاصم');
});

test('readingTeachers with readOf, and the teachers paragraph names what was read on each', () => {
  const conns = [conn(1, 'أ', 2, { items: [{ riwaya_id: 2 }] }), conn(2, 'ب', 2, { items: [{ qiraa_id: 1 }] })];
  const t = readingTeachers(conns, 'quran', { option: { qiraa_id: 1, riwaya_id: 2 }, riwayaQiraa: () => 1, readOf: links => `قرأ ${links.length}` });
  assert.deepEqual(t.map(x => x.read), ['قرأ 1', 'قرأ 1']);
  const p = teachersParagraph([{ name: 'أ', read: 'بالقراءات العشر الصغرى', reading_mode: 'heart' }, { name: 'ب', read: 'برواية حفص عن عاصم' }],
    'منهم: {الشيوخ}.', { heart: 'غيباً' });
  assert.equal(p, 'منهم: الشيخ أ بالقراءات العشر الصغرى غيباً، والشيخ ب برواية حفص عن عاصم.');
});

test('withReads: plain from the rawi upward (rawi, imam and their shaykhs)', () => {
  const lists = { ...L, riwayat: L.riwayat.map(r => (r.id === 11 ? { ...r, rawi_id: 51 } : r)), qiraat: L.qiraat.map(q => (q.id === 1 ? { ...q, imam_id: 50 } : q)) };
  const chain = [
    { from_person_id: 0, to_person_id: 9, items: [{ qiraa_id: 1 }] },
    { from_person_id: 9, to_person_id: 51, items: [{ qiraa_id: 1 }] },          // on حفص: still said («بها»)
    { from_person_id: 51, to_person_id: 50, items: [{ riwaya_id: 11 }] },       // حفص → عاصم: plain
    { from_person_id: 50, to_person_id: 60, items: [{ riwaya_id: 11 }] },       // عاصم → السلمي: plain
    { from_person_id: 60, to_person_id: 61, items: [{ qiraa_id: 1 }] },         // above: plain
  ];
  assert.deepEqual(withReads([chain], HAFS, lists)[0].map(e => e.read_with), ['بقراءة عاصم', 'بها', undefined, undefined, undefined]);
});

test('readingWords and isnadSections', async () => {
  const { readingWords, isnadSections, multiIsnadTemplate } = await import('../src/utils/ijaza.js');
  assert.equal(readingWords('قراءة نافع', 'رواية قالون'), 'رواية قالون عن نافع');
  assert.equal(readingWords('عاصم'), 'قراءة عاصم');
  assert.equal(isnadSections([{ label: 'رواية حفص', text: 'قرأتُ على أ' }]), 'قرأتُ على أ');
  assert.equal(isnadSections([{ label: 'رواية قالون عن نافع', text: 'قرأتُ على أ' }, { label: 'رواية حفص عن عاصم', text: 'قرأتُ على ب' }]),
    'وإسنادي في رواية قالون عن نافع: قرأتُ على أ.\n\nوإسنادي في رواية حفص عن عاصم: قرأتُ على ب');
  assert.equal(multiIsnadTemplate('…\n\nوإسنادي فيه: {الإسناد}.\n\n…'), '…\n\n{الإسناد}.\n\n…');
});

test('ijazaChoices: groups, whole qiraat that have riwayat, riwayat; addChoice and choicesReading', async () => {
  const { ijazaChoices, addChoice, choicesReading } = await import('../src/utils/quranOptions.js');
  const lists = {
    qiraat: [{ id: 1, name_ar: 'قراءة عاصم' }, { id: 2, name_ar: 'قراءة نافع' }],
    riwayat: [{ id: 11, qiraa_id: 1, name_ar: 'رواية حفص' }, { id: 12, qiraa_id: 1, name_ar: 'رواية شعبة' }, { id: 21, qiraa_id: 2, name_ar: 'رواية قالون' }],
    turuq: [], groups: [{ id: 3, name_ar: 'الصغرى', text_ar: 'القراءات العشر الصغرى', items: [{ qiraa_id: 2 }] }],
  };
  const conns = [
    { from_person_id: 0, to_name: 'أ', items: [{ qiraa_id: 1 }] },
    { from_person_id: 0, to_name: 'ب', items: [], groups: [{ group_id: 3 }], books: [{ matn_id: 9, title: 'الشاطبية' }] },
  ];
  const ch = ijazaChoices(conns, lists);
  assert.deepEqual(ch.map(c => [c.key, c.kind, c.label]), [
    ['g3', 'group', 'القراءات العشر الصغرى'],
    ['w1', 'whole', 'قراءة عاصم'], ['w2', 'whole', 'قراءة نافع'],
    ['r11-t0', 'riwaya', 'رواية حفص عن عاصم'], ['r12-t0', 'riwaya', 'رواية شعبة عن عاصم'], ['r21-t0', 'riwaya', 'رواية قالون عن نافع'],
  ]);
  assert.match(ch[1].url, /group-paths\?qiraa_id=1/);
  let picked = addChoice([], 'r11-t0', ch);
  picked = addChoice(picked, 'r21-t0', ch);
  assert.deepEqual(picked, ['r11-t0', 'r21-t0']);
  assert.deepEqual(addChoice(picked, 'w1', ch), ['r21-t0', 'w1']);           // the whole qiraa replaces حفص
  assert.deepEqual(addChoice(['w1'], 'r12-t0', ch), ['w1']);                 // already covered
  const byKey = k => ch.find(c => c.key === k);
  assert.equal(choicesReading(['r21-t0', 'r11-t0'].map(byKey)), 'برواية قالون عن نافع ورواية حفص عن عاصم');
  assert.equal(choicesReading([byKey('g3')], { withBooks: true }), 'بالقراءات العشر الصغرى بمضمن الشاطبية');
});
