/**
 * Transmission kinds — the meaning of a transmission type, independent of its id.
 * Every database names and numbers its transmission_types differently, so all logic
 * (ranking, sentences, keywords, reading mode, tree colours) works on kinds.
 * A type's kind is its `kind` column, or guessed from its name when that is empty.
 */
const KINDS = [
  // key            label                        rank (lower = stronger)
  { key: 'lafz',          label: 'سماع من لفظ الشيخ',      rank: 0 },
  { key: 'sama',          label: 'سماع',                   rank: 1 },
  { key: 'qiraa',         label: 'قراءة على الشيخ',         rank: 1 },
  { key: 'ard',           label: 'عرض',                    rank: 1 },
  { key: 'sama_reading',  label: 'قراءة عليه وأنا أسمع',     rank: 2 },
  { key: 'munawala',      label: 'مناولة',                  rank: 3 },
  { key: 'ijaza',         label: 'إجازة',                   rank: 4 },
  { key: 'kitaba',        label: 'كتابة / مكاتبة',           rank: 5 },
  { key: 'ijaza_general', label: 'إجازة عامة',              rank: 6 },
  { key: 'ilam',          label: 'إعلام',                   rank: 7 },
  { key: 'wasiyya',       label: 'وصية',                    rank: 8 },
  { key: 'wijada',        label: 'وجادة',                   rank: 9 },
];
const KEYS = new Set(KINDS.map(k => k.key));
const UNTYPED_RANK = 10;

// order matters: «الإجازة العامة» before «إجازة», «قراءة عليه وأنا أسمع» before «قراءة» and «سماع»
const NAME_RULES = [
  [/لفظ/, 'lafz'],
  [/وأنا أسمع|وانا اسمع|بقراءة غير|بقراءه غير/, 'sama_reading'],
  [/عام/, 'ijaza_general'],
  [/[إا]جاز/, 'ijaza'],
  [/سماع|سمع/, 'sama'],
  [/عرض/, 'ard'],
  [/قراء|قرأ|قرا/, 'qiraa'],
  [/مناول/, 'munawala'],
  [/كتاب|مكاتب/, 'kitaba'],
  [/[إا]علام/, 'ilam'],
  [/وصي/, 'wasiyya'],
  [/وجاد/, 'wijada'],
];

const kindFromName = name => {
  const n = String(name ?? '');
  const hit = NAME_RULES.find(([re]) => re.test(n));
  return hit ? hit[1] : null;
};

/** Kind of a transmission type row ({ kind, name_ar }) or of an edge ({ tx_kind, tx_name }). */
const kindOf = x => {
  if (!x) return null;
  const explicit = x.kind ?? x.tx_kind;
  if (explicit && KEYS.has(explicit)) return explicit;
  return kindFromName(x.name_ar ?? x.tx_name);
};

const rankOf = kind => KINDS.find(k => k.key === kind)?.rank ?? UNTYPED_RANK;

// ids of the original seed (schema.sql), used only to convert settings saved by older versions
const SEED_KINDS = { 1: 'sama', 2: 'qiraa', 3: 'ijaza', 4: 'ijaza_general', 5: 'munawala', 6: 'kitaba', 7: 'wijada', 8: 'ilam', 9: 'ard', 10: 'sama_reading' };

module.exports = { KINDS, KEYS, kindFromName, kindOf, rankOf, UNTYPED_RANK, SEED_KINDS };
