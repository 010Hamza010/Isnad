const { mergeSettings } = require('./settings');
const { normalizeArabic, tokenize } = require('./normalize');

const JOINERS = new Set(['كلاهما', 'كلهما', 'كلهم', 'جميعا', 'كلاهم'].map(normalizeArabic));
const CONJ = /^[وف]/; // وأخبرنا، فحدثنا

const phrase = s => tokenize(s).map(t => t.norm);

function buildMatcher(s) {
  const forms = [];
  s.keywords.forEach(k => [k.word, k.abbr, ...(k.variants || [])].filter(Boolean)
    .forEach(f => forms.push({ seq: phrase(f), keyword: k })));
  forms.sort((a, b) => b.seq.length - a.seq.length); // longest match first («قرأت على» before «قرأت»)

  // try at tokens[i]; the first word may carry a و/ف prefix
  return (tokens, i) => {
    for (const { seq, keyword } of forms) {
      if (i + seq.length > tokens.length) continue;
      const ok = seq.every((w, j) => {
        const t = tokens[i + j].norm;
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
    const m = match(tokens, i);
    if (m) {
      if (cur) links.push(cur);
      cur = { keyword: m.keyword.word, tx_type_id: m.keyword.tx_type_id, words: [] };
      i += m.length;
      continue;
    }
    const death = tokens[i].raw.match(DEATH_TOKEN);
    if (death) {
      const year = ctx.deaths[Number(death[1])];
      if (cur) cur.death_year = year; else startDeath = year;
      i++; continue;
    }
    const clear = ctx.phraseAt(tokens, i);
    if (clear) {
      if (cur && cur.tx_type_id == null) cur.tx_type_id = clear.tx; // «عن فلان سماعاً عليه» → سماع
      i += clear.seq.length; continue;
    }
    if (fillers.has(tokens[i].norm)) { i++; continue; }
    (cur ? cur.words : startWords).push(tokens[i]);
    i++;
  }
  if (cur) links.push(cur);

  const named = links
    .map(l => ({ keyword: l.keyword, tx_type_id: l.tx_type_id, name: cleanName(l.words, s.titles), death_year: l.death_year || null }))
    .filter(l => {
      if (l.name) return true;
      warnings.push(`صيغة «${l.keyword}» بلا اسم بعدها — تم تجاهلها`);
      return false;
    });

  return { start: startWords.length ? cleanName(startWords, s.titles) : null, start_death_year: startDeath, links: named };
}

/**
 * Text → chains. Inverse of render.renderChains.
 * Returns { chains: [{ start: string|null, start_death_year, links: [{ keyword, tx_type_id, name, death_year }] }], warnings }.
 * start === null means the chain begins with me (the speaker of the first keyword).
 */
const DEATH = /^\s*(?:ت|توفي|توفّي|المتوفى)\.?\s*(.+?)\s*$/;
const DEATH_TOKEN = /^⟨D(\d+)⟩$/;

// «(ت 852هـ)» → a marker token ⟨Dn⟩ (value kept in `deaths[n]`) attached to the preceding name;
// other parentheses and note markers «[[12]]» from rendered text are dropped.
function prepare(text) {
  const deaths = [];
  const out = String(text ?? '')
    .replace(/\[\[-?\d+\]\]/g, ' ')
    .replace(/\(([^()]*)\)/g, (_, inner) => {
      const m = inner.match(DEATH);
      if (!m) return ' ';
      deaths.push(m[1].trim());
      return ` ⟨D${deaths.length - 1}⟩ `;
    });
  return { text: out, deaths };
}

// clear phrases («قراءةً عليه وأنا أسمع») → transmission type, used when the keyword is plain «عن»
function buildPhraseMatcher(s) {
  const seqs = [];
  [s.clear.first, s.clear.others].forEach(map => Object.entries(map).forEach(([tx, p]) => {
    if (p) seqs.push({ seq: phrase(p), tx: tx === 'null' ? null : Number(tx) });
  }));
  seqs.sort((a, b) => b.seq.length - a.seq.length);
  return (tokens, i) => seqs.find(({ seq }) => seq.every((w, j) => tokens[i + j]?.norm === w)) || null;
}

function parseIsnad(text, settings) {
  const s = mergeSettings(settings);
  const match = buildMatcher(s);
  const warnings = [];
  const prepared = prepare(text);
  const ctx = { deaths: prepared.deaths, phraseAt: buildPhraseMatcher(s) };
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
    .map(c => ({ start: c.start, start_death_year: c.start_death_year, links: [...c.links, ...(tail?.links || [])] }))
    .filter(c => c.links.length); // a name with no keyword is not a chain

  if (!chains.length && String(text).trim()) warnings.push('لم يُعثر على أي صيغة أداء في النص');
  return { chains, warnings };
}

module.exports = { parseIsnad };
