// Normalize Arabic for forgiving search: strip tashkeel, Quranic marks, tatweel and invisible marks,
// unify letter variants and digits. Used by every search and name match (backend: isnadText/normalize.js).
export function normalizeArabic(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')  // tashkeel, Quranic marks, dagger alef, tatweel
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')  // invisible marks pasted with the text (RLM, ZWNJ…)
    .replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660)  // ٨٥٢ → 852
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')  // and Persian ye
    .replace(/ک/g, 'ك')  // Persian kaf
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export const matches = (query, ...fields) => {
  const q = normalizeArabic(query);
  return !q || fields.some(f => normalizeArabic(f).includes(q));
};

// Arabic plural-aware counter: 1 سند، 2 سندان، 3-10 أسانيد، 11+ سنداً
export function countLabel(n, [one, two, few, many]) {
  if (n === 0) return `لا ${few}`;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const ME_ID = 0;
export const isMe = id => Number(id) === ME_ID;
