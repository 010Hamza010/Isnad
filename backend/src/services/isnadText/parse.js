const { mergeSettings } = require('./settings');
const { LINK_FORMS, MANNERS } = require('./vocabulary');
const { expandGender } = require('./gender');
const { normalizeArabic, keyOf, tokenize } = require('./normalize');

const JOINERS = new Set(['كلاهما', 'كلهما', 'كلهم', 'جميعا', 'كلاهم', 'كلتاهما', 'كلتيهما', 'كلهن'].map(normalizeArabic));
const CONJ = /^[وف]/; // وأخبرنا، فحدثنا
const AND_TOKEN = '⟨AND⟩'; // stands for «، و» in the text (see prepare / parseSegment)

const phrase = s => tokenize(s).map(t => t.norm);
const keys = s => tokenize(s).map(t => t.key);       // strict form for keywords / manners

// split «قُرئ على {الاسم} وأنا أسمع» into its prefix and suffix
const NAME_SLOT = '{الاسم}';
// every gendered variant is recognised («وهو قرأ على» and «وهي قرأت على»)
const phraseParts = s => [s.phrases.first, s.phrases.others].flatMap(map => Object.entries(map)
  .filter(([, p]) => p && p.includes(NAME_SLOT))
  .flatMap(([tx, p]) => expandGender(p).map(v => {
    const [before, after] = v.split(NAME_SLOT);
    return { tx: tx === 'null' ? null : tx, prefix: before.trim(), suffix: after.trim() };
  })));

function buildMatcher(s) {
  const forms = [];
  s.keywords.forEach(k => [k.word, k.abbr, ...(k.variants || [])].filter(Boolean)
    .forEach(f => forms.push({ seq: keys(f), keyword: k })));
  // clear sentences act as keywords too: «وهو قرأ على» → قراءة
  phraseParts(s).forEach(({ prefix, tx }) => {
    if (prefix) forms.push({ seq: keys(prefix), keyword: { word: prefix, kind: tx } });
  });
  // built-in forms («بسماعه من»…) unless the user's keywords already cover them
  const known = new Set(forms.map(f => f.seq.join(' ')));
  LINK_FORMS.forEach(([f, tx]) => {
    const seq = keys(f);
    if (!known.has(seq.join(' '))) forms.push({ seq, keyword: { word: f, kind: tx } });
  });
  forms.sort((a, b) => b.seq.length - a.seq.length); // longest match first («قرأت على» before «قرأت»)

  // try at tokens[i]; the first word may carry a و/ف prefix
  return (tokens, i) => {
    for (const { seq, keyword } of forms) {
      if (i + seq.length > tokens.length) continue;
      const ok = seq.every((w, j) => {
        const t = tokens[i + j].key;
        return t === w || (j === 0 && CONJ.test(t) && t.slice(1) === w);
      });
      if (ok) return { keyword, length: seq.length };
    }
    return null;
  };
}

// drop honorific phrases (multi-word) wherever they occur
function stripPhrases(tokens, phrases) {
  const seqs = phrases.map(phrase).filter(p => p.length).sort((a, b) => b.length - a.length);
  const out = [];
  for (let i = 0; i < tokens.length;) {
    const hit = seqs.find(seq => seq.every((w, j) => tokens[i + j]?.norm === w));
    if (hit) { i += hit.length; continue; }
    out.push(tokens[i++]);
  }
  return out;
}

function cleanName(words, titles) {
  const t = new Set(titles.map(normalizeArabic));
  let i = 0;
  while (i < words.length - 1 && t.has(words[i].norm)) i++; // keep at least one word
  return words.slice(i).map(w => w.raw).join(' ');
}

// One chain without تحويل: [start name] kw name kw name …
function parseSegment(tokens, s, match, warnings, ctx) {
  const fillers = new Set(s.fillers.map(normalizeArabic));
  let startWords = [];
  let startDeath = null;
  const links = [];
  let cur = null;

  for (let i = 0; i < tokens.length;) {
    const death = tokens[i].raw.match(DEATH_TOKEN);
    if (death) {
      const year = ctx.deaths[Number(death[1])];
      if (cur) cur.death_year = year; else startDeath = year;
      i++; continue;
    }
    // «قرأتُ على شيخنا A، وشيخنا B» — «، و» before a name (not «، وهو قرأ…» nor «، وعن…»): a second
    // person in the same link; each one becomes its own chain
    if (tokens[i].raw === AND_TOKEN) {
      const next = tokens[i + 1];
      if (cur && cur.words.length && next && /^و./.test(next.raw) && !match(tokens, i + 1) && !ctx.suffixAt(tokens, i + 1)
          && !JOINERS.has(next.norm)) {
        cur.alts.push({ words: cur.words, death_year: cur.death_year });
        cur.words = []; cur.death_year = undefined;
        const raw = next.raw.slice(1);
        tokens[i + 1] = { raw, norm: normalizeArabic(raw), key: keyOf(raw) };
      }
      i++; continue;
    }
    // sentence endings first: «وأنا أسمع» must not be read as the keyword «أنا»
    // only after a name: «سماعاً عليه» before any name is ordinary text
    const suffix = cur && cur.words.length ? ctx.suffixAt(tokens, i) : null;
    if (suffix) {
      if (suffix.tx !== undefined) cur.tx_kind = suffix.tx; // «عن فلان سماعاً عليه» → سماع
      if (suffix.mode) cur.reading_mode = suffix.mode;        // «… حفظاً»
      i += suffix.seq.length; continue;
    }
    const m = match(tokens, i);
    if (m) {
      if (cur) links.push(cur);
      cur = { keyword: m.keyword.word, tx_kind: m.keyword.kind ?? null, words: [], alts: [] };
      i += m.length;
      continue;
    }
    if (fillers.has(tokens[i].norm)) { i++; continue; }
    (cur ? cur.words : startWords).push(tokens[i]);
    i++;
  }
  if (cur) links.push(cur);

  const named = links
    .map(l => ({
      keyword: l.keyword, tx_kind: l.tx_kind, name: cleanName(l.words, s.titles), death_year: l.death_year || null, reading_mode: l.reading_mode || null,
      ...(l.alts.length ? { alternatives: [...l.alts.map(a => ({ name: cleanName(a.words, s.titles), death_year: a.death_year || null })), null] } : {}),
    }))
    .filter(l => {
      if (l.name) return true;
      warnings.push(`صيغة «${l.keyword}» بلا اسم بعدها — تم تجاهلها`);
      return false;
    });

  return { start: startWords.length ? cleanName(startWords, s.titles) : null, start_death_year: startDeath, links: named };
}

/**
 * Text → chains. Inverse of render.renderChains.
 * Returns { chains: [{ start: string|null, start_death_year, links: [{ keyword, tx_kind, name, death_year, reading_mode }] }], warnings }.
 * start === null means the chain begins with me (the speaker of the first keyword).
 */
const DEATH = /^\s*(?:ت|توفي|توفّي|المتوفى)\.?\s*(.+?)\s*$/;
const DEATH_TOKEN = /^⟨D(\d+)⟩$/;

// «(ت 852هـ)» → a marker token ⟨Dn⟩ (value kept in `deaths[n]`) attached to the preceding name;
// other parentheses and note markers «[[12]]» from rendered text are dropped.
function prepare(text, s) {
  const deaths = [];
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let src = String(text ?? '');
  // a new paragraph «وأرويه أيضاً: …» is a تحويل; «… بالسند المتقدم إلى فلان» restarts from فلان («وعن فلان»)
  if (s.style.longRestart) src = src.replace(new RegExp(`(^|\\n)\\s*${esc(s.style.longRestart)}\\s*:?`, 'g'), ` ${s.style.tahwil} `);
  src = src.replace(/بالسند المتقدم إلى/g, 'عن').replace(/،\s*(?=و\S)/g, ` ${AND_TOKEN} `);
  const out = src
    .replace(/\[\[-?\d+\]\]/g, ' ')
    .replace(/\(([^()]*)\)/g, (_, inner) => {
      const m = inner.match(DEATH);
      if (!m) return ' ';
      deaths.push(m[1].trim());
      return ` ⟨D${deaths.length - 1}⟩ `;
    });
  return { text: out, deaths };
}

// Phrases after a name — sentence endings («وأنا أسمع») and manners («سماعاً عليه»، «حفظاً») —
// are dropped from the name; they set the link's type and/or reading mode.
function buildSuffixMatcher(s) {
  const seqs = [
    ...phraseParts(s).filter(p => p.suffix).map(p => ({ seq: keys(p.suffix), tx: p.tx })),
    ...MANNERS.map(([text, m]) => ({ seq: keys(text), ...m })),
  ];
  seqs.sort((a, b) => b.seq.length - a.seq.length);
  return (tokens, i) => seqs.find(({ seq }) => seq.length && seq.every((w, j) => tokens[i + j]?.key === w)) || null;
}

// a link naming several people («على A، وB») → one chain per person (null = the link's own name)
function expandAlternatives(seg) {
  const i = seg.links.findIndex(l => l.alternatives);
  if (i === -1) return [seg];
  const { alternatives, ...link } = seg.links[i];
  return alternatives.flatMap(alt => expandAlternatives({
    ...seg,
    links: seg.links.map((l, j) => (j !== i ? l : alt ? { ...link, name: alt.name, death_year: alt.death_year } : link)),
  }));
}

function parseIsnad(text, settings) {
  const s = mergeSettings(settings);
  const match = buildMatcher(s);
  const warnings = [];
  const prepared = prepare(text, s);
  const ctx = { deaths: prepared.deaths, suffixAt: buildSuffixMatcher(s) };
  const tokens = stripPhrases(tokenize(prepared.text), s.honorifics);
  const tahwil = normalizeArabic(s.style.tahwil);

  // split off a shared tail introduced by كلاهما/كلهم
  const j = tokens.findIndex(t => JOINERS.has(t.norm));
  const headTokens = j === -1 ? tokens : tokens.slice(0, j);
  const tailTokens = j === -1 ? [] : tokens.slice(j + 1);

  // split heads on the تحويل marker
  const heads = [[]];
  headTokens.forEach(t => (t.norm === tahwil ? heads.push([]) : heads[heads.length - 1].push(t)));

  const tail = tailTokens.length ? parseSegment(tailTokens, s, match, warnings, ctx) : null;
  if (tail?.start) warnings.push(`نص غير مفهوم بعد «كلاهما»: «${tail.start}»`);

  const chains = heads
    .filter(h => h.length)
    .map(h => parseSegment(h, s, match, warnings, ctx))
    .flatMap(expandAlternatives)
    .map(c => ({ start: c.start, start_death_year: c.start_death_year, links: [...c.links, ...(tail?.links || [])] }))
    .filter(c => c.links.length); // a name with no keyword is not a chain

  if (!chains.length && String(text).trim()) warnings.push('لم يُعثر على أي صيغة أداء في النص');
  return { chains, warnings };
}

module.exports = { parseIsnad };
