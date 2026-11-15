// Same rules as frontend/src/utils/text.js — keep the two in sync.
const normalizeArabic = s => String(s ?? '')
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

// Stricter key for matching keywords: like normalizeArabic but keeps ى ≠ ي,
// so «على» (a keyword) never swallows the name «علي».
const keyOf = s => String(s ?? '')
  .toLowerCase()
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .trim();

const PUNCT = /[،,:؛;.!؟?«»"'()\[\]{}\-–—…]+/g;

// Split text into word tokens, keeping the original spelling for display.
const tokenize = text => String(text ?? '')
  .replace(/ﷺ/g, ' ')
  .replace(PUNCT, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .map(raw => ({ raw, norm: normalizeArabic(raw), key: keyOf(raw) }));

const isMe = id => Number(id) === 0;

module.exports = { normalizeArabic, keyOf, tokenize, isMe };
