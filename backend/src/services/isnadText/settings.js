const DEFAULTS = require('./defaults');
const { normalizeArabic } = require('./normalize');
const { stripAlternations } = require('./gender');
const { KEYS: KINDS, SEED_KINDS } = require('../txKinds');
const LEGACY = require('./legacy.json'); // defaults of versions that keyed everything by seed type id

class SettingsError extends Error {}

const LIST_KEYS = ['titles', 'honorifics', 'fillers'];
const clone = o => JSON.parse(JSON.stringify(o));

const kindKey = k => (k == null || k === 'null' || k === '' ? 'null' : String(k));
const sig = k => JSON.stringify([k.word, k.abbr || '', k.variants || [], k.tx_type_id ?? null]);
const LEGACY_SIGS = new Set(LEGACY.keywords.map(sig));

/*
 * Settings saved before transmission kinds referenced type ids:
 *  - entries identical to an old default were written with the *seed* numbering → replaced by
 *    the current default for the same word;
 *  - entries the user edited were picked from *their* database's types → converted with
 *    `idKinds` (id → kind from the transmission_types table), falling back to the seed numbering.
 */
const idToKind = (id, idKinds) => (id == null ? null : idKinds?.[id] ?? SEED_KINDS[id] ?? null);

function upgradeKeywords(list, idKinds) {
  if (!list.some(k => k && 'tx_type_id' in k && !('kind' in k))) return list;
  return list.map(k => {
    if (!k || 'kind' in k) return k;
    if (LEGACY_SIGS.has(sig(k))) {
      const now = DEFAULTS.keywords.find(d => d.word === k.word);
      if (now) return clone(now);
    }
    const { tx_type_id, ...rest } = k;
    return { ...rest, kind: LEGACY_SIGS.has(sig(k)) ? SEED_KINDS[tx_type_id] ?? null : idToKind(tx_type_id, idKinds) };
  });
}

function upgradePhrases(which, map, idKinds) {
  const out = {};
  Object.entries(map).forEach(([key, v]) => {
    if ((LEGACY.phrases[which]?.[key] || []).includes(v)) return; // an old default: the new default applies
    if (!/^\d+$/.test(key)) { out[key] = v; return; }           // already a kind key (or 'null')
    const kind = idToKind(key, idKinds);
    if (kind) out[kind] = v;
  });
  return out;
}

/**
 * Stored (partial) settings on top of defaults. Arrays replace, style merges.
 * idKinds: { [transmission type id]: kind } of this database, to convert settings saved by older versions.
 */
function mergeSettings(stored, idKinds) {
  const s = clone(DEFAULTS);
  if (!stored || typeof stored !== 'object') return s;
  if (Array.isArray(stored.keywords)) s.keywords = upgradeKeywords(stored.keywords, idKinds);
  if (stored.style && typeof stored.style === 'object') {
    s.style = { ...s.style, ...stored.style };
    // the first default was «حفظاً»; follow the new default unless the user chose something else
    if (s.style.heartWord === 'حفظاً') s.style.heartWord = DEFAULTS.style.heartWord;
  }
  LIST_KEYS.forEach(k => { if (Array.isArray(stored[k])) s[k] = stored[k]; });
  ['first', 'others', 'joined', 'also'].forEach(k => {
    if (!stored.phrases?.[k] || typeof stored.phrases[k] !== 'object') return;
    Object.assign(s.phrases[k], upgradePhrases(k, stored.phrases[k], idKinds));
  });
  return s;
}

// also-phrases name the narrator too: {الراوي} once
const phraseMap = (m, field, withNarrator = false) => {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new SettingsError(`${field}: invalid`);
  return Object.fromEntries(Object.entries(m).map(([k, v]) => {
    if (k !== 'null' && !KINDS.has(k)) throw new SettingsError(`${field}: invalid key ${k}`);
    const v2 = str(v, 160, `${field}.${k}`);
    const plain = stripAlternations(v2);
    if (v2 && (plain.match(/\{الاسم\}/g) || []).length !== 1) throw new SettingsError(`${field}.${k}: must contain {الاسم} once`);
    if (withNarrator && v2 && (plain.match(/\{الراوي\}/g) || []).length !== 1) throw new SettingsError(`${field}.${k}: must contain {الراوي} once`);
    const rest = plain.replace(/\{الاسم\}/g, '');
    if (/[{}]/.test(withNarrator ? rest.replace(/\{الراوي\}/g, '') : rest)) throw new SettingsError(`${field}.${k}: use {الراوي:مذكر|مؤنث} or {الشيخ:مذكر|مؤنث}`);
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
function validateSettings(input, idKinds) {
  if (!input || typeof input !== 'object') throw new SettingsError('settings: must be an object');
  const merged = mergeSettings(input, idKinds);

  if (!merged.keywords.length || merged.keywords.length > 100) throw new SettingsError('keywords: 1–100 items');
  const keywords = merged.keywords.map((k, i) => {
    const f = `keywords[${i}]`;
    if (!k || typeof k !== 'object') throw new SettingsError(`${f}: invalid`);
    const kind = k.kind === '' || k.kind == null ? null : String(k.kind);
    if (kind !== null && !KINDS.has(kind)) throw new SettingsError(`${f}.kind: invalid`);
    return {
      word: str(k.word, 40, `${f}.word`, { required: true }),
      abbr: str(k.abbr, 20, `${f}.abbr`),
      variants: strList(k.variants || [], `${f}.variants`, 20),
      kind,
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

  // at most one preferred form per transmission kind
  const pref = new Set();
  keywords.forEach(k => {
    if (!k.preferred) return;
    const key = kindKey(k.kind);
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
    fullNames: !!st.fullNames,
    tahwilMeet: st.tahwilMeet === 'joined' ? 'joined' : 'repeat',
    authorTitle: str(st.authorTitle, 30, 'style.authorTitle'),
    longRestart: str(st.longRestart, 40, 'style.longRestart'),
    longRestartWords: Math.min(500, Math.max(5, Math.round(Number(st.longRestartWords) || DEFAULTS.style.longRestartWords))),
  };
  const phrases = Object.fromEntries(['first', 'others', 'joined', 'also'].map(k => [k, phraseMap(merged.phrases[k] || {}, `phrases.${k}`, k === 'also')]));

  const out = { keywords, style, phrases };
  LIST_KEYS.forEach(k => { out[k] = strList(merged[k], k); });
  return out;
}

module.exports = { mergeSettings, validateSettings, SettingsError, DEFAULTS, kindKey };
