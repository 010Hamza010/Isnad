// Normalize Arabic for forgiving search: strip tashkeel/tatweel, unify letter variants.
export function normalizeArabic(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')  // harakat, dagger alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
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
