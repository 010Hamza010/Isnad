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

// {المجاز:فأجزته|فأجزتها} — masculine|feminine by the student (المجاز) or me (المجيز); same syntax as the backend
const GENDER_RE = /\{([^{}:|\n]{1,20}):([^{}|\n]*)\|([^{}|\n]*)\}/g;
export const applyGender = (text, genders = {}) =>
  String(text ?? '').replace(GENDER_RE, (whole, role, m, f) => (role in genders ? (genders[role] === 'F' ? f : m) : whole));

/**
 * Replace {key} with values[key]. Unknown or empty keys stay visible and are reported,
 * except `optional` keys, which simply disappear (with their now-empty paragraph).
 */
export function fillTemplate(template, values, { optional = [], genders = {} } = {}) {
  const missing = new Set();
  const skip = new Set(optional);
  const text = applyGender(template, genders).replace(PLACEHOLDER_RE, (whole, key) => {
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

// connections where I read (قراءة) or presented (عرض) — the ones that count as «قرأتُ عليه».
// By transmission *kind* (from the API), never by type id: ids differ between databases.
const READ_KINDS = new Set(['qiraa', 'ard']);

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
    if (Number(c.from_person_id) !== 0 || !READ_KINDS.has(c.tx_kind)) return;
    if (module === 'mutoon' && String(c.matn_id) !== String(matnId)) return;
    if (module === 'quran' && (!option || !coversQuran(c, option, riwayaQiraa))) return;
    if (module !== 'mutoon' && module !== 'quran') return;
    const prev = seen.get(c.to_person_id);
    if (!prev || (!prev.reading_mode && c.reading_mode)) {
      seen.set(c.to_person_id, { id: c.to_person_id, name: c.to_name, gender: c.to_gender === 'F' ? 'F' : 'M', reading_mode: c.reading_mode || null });
    }
  });
  return [...seen.values()];
}

/**
 * The teachers paragraph, or '' when fewer than two shuyukh (then it is left out).
 * «منهم: الشيخ أ غيباً من حفظي، والشيخة ب»
 * titles: { M, F } (a plain string is used for both).
 */
export function teachersParagraph(teachers, sentence, words = {}, titles = { M: 'الشيخ', F: 'الشيخة' }) {
  if (teachers.length < 2 || !sentence) return '';
  const t2 = typeof titles === 'string' ? { M: titles, F: titles } : titles;
  const items = teachers.map(t => {
    const mode = { heart: words.heart, looking: words.looking }[t.reading_mode];
    const title = t2[t.gender === 'F' ? 'F' : 'M'];
    const name = title ? `${title} ${t.name}` : t.name;
    return mode ? `${name} ${mode}` : name;
  });
  return sentence.replace('{الشيوخ}', joinArabic(items));
}

// how the student received, by transmission kind — [masculine, feminine]
const TAKHAMMUL = {
  lafz: ['سمع من لفظي', 'سمعت من لفظي'], sama: ['سمع مني', 'سمعت مني'], qiraa: ['قرأ عليّ', 'قرأت عليّ'],
  ard: ['عرض عليّ', 'عرضت عليّ'], sama_reading: ['سمع مني بقراءة غيره', 'سمعت مني بقراءة غيرها'],
  ijaza: ['استجازني في', 'استجازتني في'], ijaza_general: ['استجازني في', 'استجازتني في'],
  munawala: ['ناولته', 'ناولتها'], kitaba: ['كتبت إليه', 'كتبت إليها'],
};
export const takhammulPhrase = (kind, gender = 'M') => (TAKHAMMUL[kind] || TAKHAMMUL.qiraa)[gender === 'F' ? 1 : 0];

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
