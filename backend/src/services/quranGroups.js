/**
 * Groups of qiraat / riwayat («العشر الصغرى», «الحرميان»…). A Quran link stores the groups it was
 * read with; for the routes a group stands for its members (items { qiraa_id, riwaya_id }).
 */
const { HttpError } = require('../utils/httpError');
const { normalizeArabic } = require('./isnadText/normalize');

/** A link's items with the members of its groups (groupsById: Map id → { items }). */
function expandItems(items = [], groupIds = [], groupsById = new Map()) {
  const extra = groupIds.flatMap(id => groupsById.get(Number(id))?.items || [])
    .map(it => ({ qiraa_id: it.qiraa_id || null, riwaya_id: it.riwaya_id || null, tariq_id: null }));
  return [...items, ...extra];
}

/** A group to save → { name_ar, text_ar, description, items, books }, or 400. */
function validateGroup(body) {
  const name_ar = String(body?.name_ar ?? '').trim();
  if (!name_ar) throw new HttpError(400, 'اسم المجموعة مطلوب');
  if (name_ar.length > 150) throw new HttpError(400, 'اسم المجموعة طويل');
  const text_ar = String(body?.text_ar ?? '').trim().slice(0, 255) || null;
  const seen = new Set();
  const items = (Array.isArray(body?.items) ? body.items : [])
    .map(it => (it?.riwaya_id ? { qiraa_id: null, riwaya_id: Number(it.riwaya_id) } : { qiraa_id: Number(it?.qiraa_id) || null, riwaya_id: null }))
    .filter(it => (it.qiraa_id || it.riwaya_id) && !seen.has(`${it.qiraa_id}-${it.riwaya_id}`) && seen.add(`${it.qiraa_id}-${it.riwaya_id}`));
  if (!items.length) throw new HttpError(400, 'اختر قراءات المجموعة أو رواياتها');
  const books = [...new Set((Array.isArray(body?.books) ? body.books : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  return { name_ar, text_ar, description: String(body?.description ?? '').trim() || null, items, books };
}

// the ten imams, found in any database by the qiraa's name, else the imam's
const IMAMS = {
  nafi: ['نافع'], ibnkathir: ['ابن كثير', 'بن كثير'], abuamr: ['ابو عمرو', 'ابي عمرو'], ibnamir: ['ابن عامر', 'بن عامر'],
  asim: ['عاصم'], hamza: ['حمزه'], kisai: ['الكسائي'], abujafar: ['ابو جعفر', 'ابي جعفر'], yaqub: ['يعقوب'], khalaf: ['خلف'],
};
const SEVEN = ['nafi', 'ibnkathir', 'abuamr', 'ibnamir', 'asim', 'hamza', 'kisai'];
const TEN = [...SEVEN, 'abujafar', 'yaqub', 'khalaf'];
const IMAM_LABEL = { nafi: 'نافع', ibnkathir: 'ابن كثير', abuamr: 'أبي عمرو', ibnamir: 'ابن عامر', asim: 'عاصم', hamza: 'حمزة',
  kisai: 'الكسائي', abujafar: 'أبي جعفر', yaqub: 'يعقوب', khalaf: 'خلف العاشر' };

/** The well-known groups («أضف المجموعات المعروفة»); books are matched by title. */
const KNOWN = [
  { name_ar: 'القراءات السبع', text_ar: 'القراءات السبع', imams: SEVEN, books: [['الشاطبيه', 'حرز الاماني']] },
  { name_ar: 'العشر الصغرى', text_ar: 'القراءات العشر الصغرى', imams: TEN, books: [['الشاطبيه', 'حرز الاماني'], ['الدره']] },
  { name_ar: 'العشر الكبرى', text_ar: 'القراءات العشر الكبرى', imams: TEN, books: [['طيبه النشر', 'الطيبه']] },
  { name_ar: 'سما', text_ar: 'قراءة نافع وابن كثير وأبي عمرو', imams: ['nafi', 'ibnkathir', 'abuamr'], books: [] },
  { name_ar: 'الحرميان', text_ar: 'قراءة الحرميين', imams: ['nafi', 'ibnkathir'], books: [] },
];

/** The qiraa of an imam: by qiraa name first, then by the imam's name; null when none or several. */
function findQiraa(key, qiraat) {
  const names = IMAMS[key].map(normalizeArabic);
  const byName = qiraat.filter(q => names.some(n => normalizeArabic(q.name_ar).includes(n)));
  const hits = byName.length ? byName : qiraat.filter(q => names.some(n => normalizeArabic(q.imam_name).includes(n)));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * The known groups for this database: [{ name_ar, text_ar, items, books, missing: [label] }],
 * skipping those that already exist by name. Nothing is written here.
 */
function planKnown({ qiraat, mutoon, existing }) {
  const have = new Set(existing.map(g => normalizeArabic(g.name_ar)));
  return KNOWN.filter(k => !have.has(normalizeArabic(k.name_ar))).map(k => {
    const missing = [];
    const items = [];
    k.imams.forEach(key => {
      const q = findQiraa(key, qiraat);
      if (q) items.push({ qiraa_id: Number(q.id), riwaya_id: null }); else missing.push(`قراءة ${IMAM_LABEL[key]}`);
    });
    const books = k.books.map(titles => mutoon.find(m => titles.some(t => normalizeArabic(m.title).includes(normalizeArabic(t))))?.id).filter(Boolean).map(Number);
    return { name_ar: k.name_ar, text_ar: k.text_ar, items, books, missing };
  });
}

module.exports = { expandItems, validateGroup, planKnown, findQiraa, KNOWN };
