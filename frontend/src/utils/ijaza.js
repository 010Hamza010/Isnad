// Ijaza templates: {placeholder} filling and the phrases that go into them.

export const PLACEHOLDERS = [
  { key: 'الطالب',          hint: 'اسم المجاز' },
  { key: 'كيفية_الأخذ',     hint: 'قرأ عليّ / سمع مني…' },
  { key: 'المتن',           hint: 'عنوان المتن' },
  { key: 'المؤلف',          hint: 'مؤلف المتن' },
  { key: 'ما_قرئ',          hint: 'برواية … من طريق …' },
  { key: 'القراءة',         hint: 'اسم القراءة' },
  { key: 'الرواية',         hint: 'اسم الرواية' },
  { key: 'الطريق',          hint: 'اسم الطريق' },
  { key: 'شيوخ_القراءة',    hint: 'فقرة الشيوخ الذين قرأت عليهم (إن كانوا أكثر من واحد)' },
  { key: 'الإسناد',         hint: 'نص الإسناد كاملاً' },
  { key: 'المجيز',          hint: 'اسمك' },
  { key: 'المكان',          hint: 'مكان الإجازة' },
  { key: 'التاريخ',         hint: 'التاريخ الميلادي' },
  { key: 'التاريخ_الهجري',  hint: 'التاريخ الهجري' },
];

const PLACEHOLDER_RE = /\{([^{}\n]{1,40})\}/g;

/**
 * Replace {key} with values[key]. Unknown or empty keys stay visible and are reported,
 * except `optional` keys, which simply disappear (with their now-empty paragraph).
 */
export function fillTemplate(template, values, { optional = [] } = {}) {
  const missing = new Set();
  const skip = new Set(optional);
  const text = String(template ?? '').replace(PLACEHOLDER_RE, (whole, key) => {
    const k = key.trim();
    const v = values[k];
    if (v == null || String(v).trim() === '') {
      if (skip.has(k)) return '';
      missing.add(k); return whole;
    }
    return String(v);
  }).replace(/\n[ \t]*(\n[ \t]*){2,}/g, '\n\n').trim();
  return { text, missing: [...missing] };
}

/** «أ، وب، وج» */
export const joinArabic = items => items.map((x, i) => (i === 0 ? x : `و${x}`)).join('، ');

// connections where I read (قراءة) or presented (عرض) — the ones that count as «قرأتُ عليه»
const READ_TX = new Set([2, 9]);

/** Does a Quran connection cover the chosen qiraa/riwaya? An unscoped (مطلق) connection covers all. */
function coversQuran(conn, opt, riwayaQiraa) {
  if (!conn.items?.length || (!opt.qiraa_id && !opt.riwaya_id)) return true;
  return conn.items.some(it => {
    if (opt.riwaya_id && it.riwaya_id) return String(it.riwaya_id) === String(opt.riwaya_id);
    const q = it.qiraa_id || (it.riwaya_id && riwayaQiraa(it.riwaya_id));
    return !q || String(q) === String(opt.qiraa_id);
  });
}

/**
 * The shuyukh I read this matn / riwaya on, from my direct connections (one entry per shaykh).
 * module 'mutoon': { matnId }; module 'quran': { option, riwayaQiraa(id) → qiraa_id }.
 */
export function readingTeachers(conns, module, { matnId, option, riwayaQiraa = () => null } = {}) {
  const seen = new Map();
  conns.forEach(c => {
    if (Number(c.from_person_id) !== 0 || !READ_TX.has(Number(c.transmission_type_id))) return;
    if (module === 'mutoon' && String(c.matn_id) !== String(matnId)) return;
    if (module === 'quran' && (!option || !coversQuran(c, option, riwayaQiraa))) return;
    if (module !== 'mutoon' && module !== 'quran') return;
    const prev = seen.get(c.to_person_id);
    if (!prev || (!prev.reading_mode && c.reading_mode)) seen.set(c.to_person_id, { id: c.to_person_id, name: c.to_name, reading_mode: c.reading_mode || null });
  });
  return [...seen.values()];
}

/** The teachers paragraph, or '' when fewer than two shuyukh (then it is left out). */
export function teachersParagraph(teachers, sentence, words = {}) {
  if (teachers.length < 2 || !sentence) return '';
  const items = teachers.map(t => {
    const mode = { heart: words.heart, looking: words.looking }[t.reading_mode];
    return mode ? `${t.name} ${mode}` : t.name;
  });
  return sentence.replace('{الشيوخ}', joinArabic(items));
}

// how the student received, by transmission_types.id
const TAKHAMMUL = { 1: 'سمع مني', 2: 'قرأ عليّ', 3: 'استجازني في', 4: 'استجازني في', 5: 'ناولته', 6: 'كتبت إليه', 9: 'عرض عليّ' };
export const takhammulPhrase = txTypeId => TAKHAMMUL[Number(txTypeId)] || 'قرأ عليّ';

const withWord = (name, word) => (name.startsWith(word) ? name : `${word} ${name}`);

/** «برواية ورش عن نافع من طريق الأزرق» — empty when nothing is specified (مطلق). */
export function readingPhrase({ qiraa, riwaya, tariq } = {}) {
  const parts = [];
  if (riwaya) parts.push(`ب${withWord(riwaya, 'رواية')}`);
  else if (qiraa) parts.push(`ب${withWord(qiraa, 'قراءة')}`);
  if (tariq) parts.push(`من ${withWord(tariq, 'طريق')}`);
  return parts.join(' ');
}

/** ISO date (YYYY-MM-DD) → { gregorian, hijri } in Arabic with Latin digits. */
export function formatDates(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { gregorian: '', hijri: '' };
  const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  const fmt = (locale, extra = '') => {
    try { return new Intl.DateTimeFormat(locale, opts).format(d) + extra; } catch { return ''; }
  };
  return {
    gregorian: fmt('ar-MA-u-nu-latn', 'م'),
    hijri: fmt('ar-SA-u-ca-islamic-umalqura-nu-latn').replace(/\s*هـ$/, '') + 'هـ',
  };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Title line of the certificate. */
export function ijazaTitle(module, { matn, reading } = {}) {
  if (module === 'mutoon') return matn ? `إجازة في متن «${matn}»` : 'إجازة';
  if (module === 'quran') return `إجازة في القرآن الكريم${reading ? ` ${reading}` : ''}`;
  return 'إجازة عامة';
}
