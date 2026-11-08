const DEFAULTS = require('./defaults');
const { normalizeArabic } = require('./normalize');
const { stripAlternations } = require('./gender');

class SettingsError extends Error {}

const LIST_KEYS = ['titles', 'honorifics', 'fillers'];
const clone = o => JSON.parse(JSON.stringify(o));

/** Stored (partial) settings on top of defaults. Arrays replace, style merges. */
function mergeSettings(stored) {
  const s = clone(DEFAULTS);
  delete s.legacyPhrases;
  if (!stored || typeof stored !== 'object') return s;
  if (Array.isArray(stored.keywords)) s.keywords = stored.keywords;
  if (stored.style && typeof stored.style === 'object') {
    s.style = { ...s.style, ...stored.style };
    // the first default was «حفظاً»; follow the new default unless the user chose something else
    if (s.style.heartWord === 'حفظاً') s.style.heartWord = DEFAULTS.style.heartWord;
  }
  LIST_KEYS.forEach(k => { if (Array.isArray(stored[k])) s[k] = stored[k]; });
  ['first', 'others'].forEach(k => {
    if (!stored.phrases?.[k] || typeof stored.phrases[k] !== 'object') return;
    Object.entries(stored.phrases[k]).forEach(([tx, v]) => {
      // a stored copy of a masculine-only default follows the new gendered default
      if (v === DEFAULTS.legacyPhrases[k]?.[tx]) return;
      s.phrases[k][tx] = v;
    });
  });
  return s;
}

const phraseMap = (m, field) => {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new SettingsError(`${field}: invalid`);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => {
    if (!/^(\d+|null)$/.test(k)) throw new SettingsError(`${field}: invalid key ${k}`);
    const v2 = str(v, 160, `${field}.${k}`);
    const plain = stripAlternations(v2);
    if (v2 && (plain.match(/\{الاسم\}/g) || []).length !== 1) throw new SettingsError(`${field}.${k}: must contain {الاسم} once`);
    if (/[{}]/.test(plain.replace(/\{الاسم\}/g, ''))) throw new SettingsError(`${field}.${k}: use {الراوي:مذكر|مؤنث} or {الشيخ:مذكر|مؤنث}`);
    return [k, v2];
  }));
};

const str = (v, max, field, { required = false } = {}) => {
  if (v == null) v = '';
  if (typeof v !== 'string') throw new SettingsError(`${field}: must be text`);
  v = v.trim();
  if (required && !v) throw new SettingsError(`${field}: required`);
  if (v.length > max) throw new SettingsError(`${field}: too long`);
  return v;
};

const strList = (v, field, maxItems = 200) => {
  if (!Array.isArray(v)) throw new SettingsError(`${field}: must be a list`);
  if (v.length > maxItems) throw new SettingsError(`${field}: too many items`);
  return [...new Set(v.map((x, i) => str(x, 60, `${field}[${i}]`)).filter(Boolean))];
};

/** Validate and normalise a full settings object; throws SettingsError with a field path. */
function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new SettingsError('settings: must be an object');
  const merged = mergeSettings(input);

  if (!merged.keywords.length || merged.keywords.length > 100) throw new SettingsError('keywords: 1–100 items');
  const keywords = merged.keywords.map((k, i) => {
    const f = `keywords[${i}]`;
    if (!k || typeof k !== 'object') throw new SettingsError(`${f}: invalid`);
    const tx = k.tx_type_id === '' || k.tx_type_id == null ? null : Number(k.tx_type_id);
    if (tx !== null && !Number.isInteger(tx)) throw new SettingsError(`${f}.tx_type_id: invalid`);
    return {
      word: str(k.word, 40, `${f}.word`, { required: true }),
      abbr: str(k.abbr, 20, `${f}.abbr`),
      variants: strList(k.variants || [], `${f}.variants`, 20),
      tx_type_id: tx,
      preferred: !!k.preferred,
    };
  });

  // every surface form must map to exactly one keyword, or parsing is ambiguous
  const seen = new Map();
  keywords.forEach((k, i) => [k.word, k.abbr, ...k.variants].filter(Boolean).forEach(form => {
    const n = normalizeArabic(form);
    if (seen.has(n) && seen.get(n) !== i) throw new SettingsError(`keywords: «${form}» is used twice`);
    seen.set(n, i);
  }));

  // at most one preferred form per transmission type
  const pref = new Set();
  keywords.forEach(k => {
    if (!k.preferred) return;
    const key = String(k.tx_type_id);
    if (pref.has(key)) k.preferred = false; else pref.add(key);
  });

  const st = merged.style || {};
  const style = {
    abbreviate: !!st.abbreviate,
    qala: !!st.qala,
    separator: typeof st.separator === 'string' && st.separator.length <= 5 ? st.separator : DEFAULTS.style.separator,
    tahwil: str(st.tahwil, 5, 'style.tahwil', { required: true }),
    firstTitle: str(st.firstTitle, 30, 'style.firstTitle'),
    firstTitleF: str(st.firstTitleF, 30, 'style.firstTitleF'),
    myGender: st.myGender === 'F' ? 'F' : 'M',
    clear: !!st.clear,
    deathYears: !!st.deathYears,
    noteMarkers: !!st.noteMarkers,
    heartWord: str(st.heartWord, 30, 'style.heartWord'),
    lookingWord: str(st.lookingWord, 30, 'style.lookingWord'),
    hideMyReadingMode: !!st.hideMyReadingMode,
  };
  const phrases = { first: phraseMap(merged.phrases.first, 'phrases.first'), others: phraseMap(merged.phrases.others, 'phrases.others') };

  const out = { keywords, style, phrases };
  LIST_KEYS.forEach(k => { out[k] = strList(merged[k], k); });
  return out;
}

module.exports = { mergeSettings, validateSettings, SettingsError, DEFAULTS };
