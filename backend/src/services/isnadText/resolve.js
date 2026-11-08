const { normalizeArabic } = require('./normalize');

// fixed nodes used by the Quran chain tail
const SACRED = [
  { id: -1, names: ['النبي', 'رسول الله', 'النبي محمد', 'نبينا محمد', 'سيدنا محمد'] },
  { id: -2, names: ['جبريل', 'جبريل عليه السلام', 'جبرائيل', 'الروح الأمين'] },
  { id: -3, names: ['الله', 'رب العزة', 'الله عز وجل', 'رب العالمين'] },
];
const RELATIVES = ['ابيه', 'جده', 'عمه', 'اخيه', 'والده', 'ابنه', 'خاله', 'زوجه', 'امه'];

const words = s => normalizeArabic(s).split(' ').filter(Boolean);

/** Index persons once for repeated lookups. */
function buildIndex(persons) {
  return persons.map(p => {
    const full = normalizeArabic(p.name_ar);
    const all = new Set(words([p.name_ar, p.kunya, p.nisba, p.name_latin].filter(Boolean).join(' ')));
    return { person: p, full, words: words(p.name_ar), all };
  });
}

/**
 * Match one parsed name against persons.
 * status: matched | ambiguous | new | relative ; candidates sorted by score (max 5).
 */
function resolveName(name, index) {
  const q = normalizeArabic(name);
  const sacred = SACRED.find(x => x.names.some(n => normalizeArabic(n) === q));
  if (sacred) return { status: 'matched', person_id: sacred.id, candidates: [] };
  if (RELATIVES.includes(q)) return { status: 'relative', person_id: null, candidates: [] };

  const qw = words(name);
  const scored = index.map(({ person, full, words: pw, all }) => {
    let score = 0;
    if (full === q) score = 1;
    else if (qw.length && qw.every(w => all.has(w))) score = 0.5 + 0.4 * (qw.length / Math.max(pw.length, qw.length));
    else if (q.length > 3 && full.includes(q)) score = 0.4;
    return { id: person.id, name_ar: person.name_ar, score: Math.round(score * 100) / 100 };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  if (!scored.length) return { status: 'new', person_id: null, candidates: [] };
  const [best, second] = scored;
  const clear = best.score === 1 ? second?.score !== 1 : best.score >= 0.7 && (!second || best.score - second.score >= 0.2);
  return clear
    ? { status: 'matched', person_id: best.id, candidates: scored }
    : { status: 'ambiguous', person_id: null, candidates: scored };
}

/** Annotate every name of parsed chains with its resolution. */
function resolveChains(parsed, persons) {
  const index = buildIndex(persons);
  return parsed.chains.map(c => ({
    start: c.start ? { name: c.start, death_year: c.start_death_year || null, ...resolveName(c.start, index) } : null,
    links: c.links.map(l => ({ ...l, ...resolveName(l.name, index) })),
  }));
}

module.exports = { resolveName, resolveChains, buildIndex };
