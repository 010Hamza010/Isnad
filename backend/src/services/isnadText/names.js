/**
 * Full names for the detailed ijaza: «أبو عبد الله محمد بن إسماعيل البخاري».
 *   kunya before the name, inflected by case (أبو / أبي / أبا), nisba after it;
 *   anything the stored name already contains is not repeated.
 * A `kunya` that is not a kunya (a laqab such as «الفخار») goes after the name with the nisba.
 */
const { normalizeArabic } = require('./normalize');

const ABU = /^[اأإآ]ب[وياى]$/;           // أبو / أبي / أبا (any hamza spelling)
const KUNYA_HEAD = /^(?:[اأإآ]ب[وياى]|[اأإآ]م)$/; // أبو… / أم…
const CASE_FORM = { nom: 'أبو', gen: 'أبي', acc: 'أبا' };

const words = s => String(s ?? '').trim().split(/\s+/).filter(Boolean);
// compare kunyas whatever their case: أبي عبد الله = أبو عبد الله
const key = w => (ABU.test(w) ? 'ابو' : normalizeArabic(w));

function contains(haystack, needle) {
  const h = haystack.map(key), n = needle.map(key);
  if (!n.length) return true;
  for (let i = 0; i + n.length <= h.length; i++) if (n.every((w, j) => h[i + j] === w)) return true;
  return false;
}

/** Put a leading أبو/أبي/أبا in the given case ('nom' | 'gen' | 'acc'); other names unchanged. */
function inflect(name, kase) {
  const w = words(name);
  if (!w.length || !ABU.test(w[0]) || !CASE_FORM[kase]) return String(name ?? '');
  return [CASE_FORM[kase], ...w.slice(1)].join(' ');
}

/** { name, kunya, nisba } → full name, kunya in case `kase`. */
function fullName({ name, kunya, nisba }, kase = 'nom') {
  let out = words(name);
  const k = words(kunya);
  const after = [];
  if (k.length && KUNYA_HEAD.test(k[0])) {
    if (!contains(out, k)) out = [...k, ...out];
  } else if (k.length && !contains(out, k)) {
    after.push(...k);
  }
  // nisba may hold several words («المري التلمساني الحسني»): add those not already there
  words(nisba).forEach(w => { if (!contains([...out, ...after], [w])) after.push(w); });
  return inflect([...out, ...after].join(' '), kase);
}

// the word before a name decides its case: a preposition («عن، على، من…») → genitive
const PREPOSITIONS = new Set(['عن', 'علي', 'من', 'الي', 'لدي', 'عند', 'ل'].map(normalizeArabic));
const caseAfter = text => {
  const last = words(String(text ?? '').replace(/[،,:؛]/g, ' ')).pop();
  return last && PREPOSITIONS.has(normalizeArabic(last)) ? 'gen' : 'nom';
};

module.exports = { fullName, inflect, caseAfter };
