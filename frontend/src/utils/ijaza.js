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
  { key: 'الإسناد',         hint: 'نص الإسناد كاملاً' },
  { key: 'المجيز',          hint: 'اسمك' },
  { key: 'المكان',          hint: 'مكان الإجازة' },
  { key: 'التاريخ',         hint: 'التاريخ الميلادي' },
  { key: 'التاريخ_الهجري',  hint: 'التاريخ الهجري' },
];

const PLACEHOLDER_RE = /\{([^{}\n]{1,40})\}/g;

/** Replace {key} with values[key]. Unknown or empty keys stay visible and are reported. */
export function fillTemplate(template, values) {
  const missing = new Set();
  const text = String(template ?? '').replace(PLACEHOLDER_RE, (whole, key) => {
    const v = values[key.trim()];
    if (v == null || String(v).trim() === '') { missing.add(key.trim()); return whole; }
    return String(v);
  });
  return { text, missing: [...missing] };
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
