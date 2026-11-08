// Same rules as frontend/src/utils/text.js — keep the two in sync.
const normalizeArabic = s => String(s ?? '')
  .toLowerCase()
  .replace(/[ً-ٰٟـ]/g, '')  // harakat, dagger alef, tatweel
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/\s+/g, ' ')
  .trim();

const PUNCT = /[،,:؛;.!؟?«»"'()\[\]{}\-–—…]+/g;

// Split text into word tokens, keeping the original spelling for display.
const tokenize = text => String(text ?? '')
  .replace(/ﷺ/g, ' ')
  .replace(PUNCT, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .map(raw => ({ raw, norm: normalizeArabic(raw) }));

const isMe = id => Number(id) === 0;

module.exports = { normalizeArabic, tokenize, isMe };
