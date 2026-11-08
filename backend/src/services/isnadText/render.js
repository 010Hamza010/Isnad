const { mergeSettings } = require('./settings');
const { isMe } = require('./normalize');

const sameTx = (a, b) => (a == null ? null : Number(a)) === (b == null ? null : Number(b));
const pick = list => list.find(k => k.preferred) || list[0];
const txKey = id => (id == null ? 'null' : String(Number(id)));

/** The keyword to write for a transmission type; falls back to the عنعنة form. */
function keywordFor(txTypeId, s) {
  const k = pick(s.keywords.filter(k => sameTx(k.tx_type_id, txTypeId)))
         || pick(s.keywords.filter(k => k.tx_type_id == null));
  if (!k) return 'عن';
  return s.style.abbreviate && k.abbr ? k.abbr : k.word;
}

/** «(ت 852هـ)» — adds هـ to a bare year. */
function deathLabel(year) {
  const y = String(year ?? '').trim();
  if (!y) return '';
  return `(ت ${/^\d+$/.test(y) ? `${y}هـ` : y})`;
}

const ANAN = new Set(['عن']);

/*
 * Render context shared by all chains of one text, so a person gets a note marker only
 * at their first mention.
 */
const newContext = () => ({ noted: new Set() });

// «name (ت …)[[id]]»
function personLabel(id, name, death, desc, s, ctx) {
  let out = name;
  if (s.style.deathYears && death) out += ` ${deathLabel(death)}`;
  const n = Number(id);
  if (s.style.noteMarkers && desc && n > 0 && !ctx.noted.has(n)) { ctx.noted.add(n); out += `[[${n}]]`; }
  return out;
}

const NAME_SLOT = '{الاسم}';

// clear sentence for a link, or null to use the keyword form
function phraseFor(e, mine, s) {
  if (!s.style.clear) return null;
  const map = mine ? s.phrases.first : s.phrases.others;
  const key = txKey(e.transmission_type_id);
  // a type left empty on purpose uses its keyword; an unknown type uses the عنعنة sentence
  return key in map ? map[key] || null : map.null || null;
}

// one phrase per edge; `opening` marks the first link of the whole isnad
function renderLinks(edges, s, ctx, { opening = true } = {}) {
  return edges.map((e, i) => {
    const first = opening && i === 0;
    const mine = first && isMe(e.from_person_id);
    const title = mine && s.style.firstTitle ? `${s.style.firstTitle} ` : '';
    const who = `${title}${personLabel(e.to_person_id, e.to_name, e.to_death_year, e.to_description, s, ctx)}`;

    const phrase = phraseFor(e, mine, s);
    if (phrase) {
      // «قرأتُ على شيخنا فلان حفظاً»
      const mode = { heart: s.style.heartWord, looking: s.style.lookingWord }[e.reading_mode];
      return phrase.replace(NAME_SLOT, mode ? `${who} ${mode}` : who);
    }

    const kw = keywordFor(e.transmission_type_id, s);
    const qala = s.style.qala && !first && !ANAN.has(kw) ? 'قال: ' : '';
    return `${qala}${kw} ${who}`;                             // «أخبرنا شيخنا فلان، عن فلان»
  });
}

function renderChainWith(edges, s, ctx) {
  if (!edges?.length) return '';
  const body = renderLinks(edges, s, ctx).join(s.style.separator);
  if (isMe(edges[0].from_person_id)) return body;
  const start = personLabel(edges[0].from_person_id, edges[0].from_name, edges[0].from_death_year, null, s, ctx);
  return `${start} ${body}`;
}

/**
 * One chain of edges → text.
 * Edges are ordered from the reader upward: { from_person_id, from_name, to_person_id, to_name,
 * transmission_type_id, to_death_year?, to_description? }.
 * If the chain starts at me (person 0) the speaker is implicit: «أخبرنا شيخنا فلان، عن فلان…».
 */
function renderChain(edges, settings) {
  return renderChainWith(edges, mergeSettings(settings), newContext());
}

// longest shared tail, compared on the person each step reaches
function sharedTail(chains) {
  const minLen = Math.min(...chains.map(c => c.length));
  let k = 0;
  for (let i = 1; i <= minLen; i++) {
    const id = String(chains[0][chains[0].length - i].to_person_id);
    if (chains.every(c => String(c[c.length - i].to_person_id) === id)) k = i; else break;
  }
  return Math.min(k, minLen - 1); // every branch keeps at least one link of its own
}

/**
 * Several alternative chains → one text using تحويل:
 * «أخبرنا شيخنا أ، عن ب ح وأخبرنا شيخنا ج، عن د، كلاهما عن هـ، عن و»
 */
function renderChains(chains, settings) {
  const s = mergeSettings(settings);
  const ctx = newContext();
  const list = (chains || []).filter(c => c?.length);
  if (list.length <= 1) return renderChainWith(list[0] || [], s, ctx);

  const k = sharedTail(list);
  const heads = list.map(c => renderChainWith(c.slice(0, c.length - k), s, ctx));
  let text = heads.map((h, i) => (i === 0 ? h : `${s.style.tahwil} و${h}`)).join(' ');
  if (k) {
    // the first shared link is replaced by «كلاهما عن X»
    const tail = list[0].slice(list[0].length - k);
    const joinPoint = personLabel(tail[0].to_person_id, tail[0].to_name, tail[0].to_death_year, tail[0].to_description, s, ctx);
    const [, ...rest] = renderLinks(tail, s, ctx, { opening: false });
    const all = list.length === 2 ? 'كلاهما' : 'كلهم';
    text += s.style.separator + [`${all} عن ${joinPoint}`, ...rest].join(s.style.separator);
  }
  return text;
}

/** A path group as returned by /api/graph/*\/paths → text. */
function renderGroup(group, settings) {
  return renderChains(groupChains(group), settings);
}

const groupChains = group => (group.chains?.length
  ? group.chains.map(c => [group.firstEdge, ...c])
  : [[group.firstEdge]]);

/** Persons mentioned in the chains (first-mention order), for margin notes. Skips me and sacred nodes. */
function collectPersons(chains) {
  const seen = new Map();
  (chains || []).forEach(c => c.forEach((e, i) => {
    const add = (id, name, death, description) => {
      const n = Number(id);
      if (n > 0 && !seen.has(n)) seen.set(n, { id: n, name, death_year: death || null, description: description || null });
    };
    if (i === 0 && !isMe(e.from_person_id)) add(e.from_person_id, e.from_name, e.from_death_year, null);
    add(e.to_person_id, e.to_name, e.to_death_year, e.to_description);
  }));
  return [...seen.values()];
}

module.exports = { renderChain, renderChains, renderGroup, groupChains, collectPersons, keywordFor, deathLabel };
