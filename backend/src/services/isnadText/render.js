const { mergeSettings } = require('./settings');
const { isMe } = require('./normalize');
const { applyGender } = require('./gender');

const { kindOf } = require('../txKinds');

// kind of an edge: its tx_kind (from transmission_types.kind or the type's name), null = untyped
const edgeKind = e => kindOf(e);
const sameKind = (a, b) => (a ?? null) === (b ?? null);
// when no keyword exists for a kind, borrow the closest one
const KIND_FALLBACK = { sama_reading: 'qiraa', ard: 'qiraa', lafz: 'sama', sama: 'lafz', ijaza_general: 'ijaza', ilam: 'ijaza', wasiyya: 'ijaza' };
const pick = list => list.find(k => k.preferred) || list[0];
const txKey = kind => (kind == null ? 'null' : String(kind));

/** The keyword to write for a transmission type; falls back to the عنعنة form. */
function keywordFor(kind, s) {
  const k = pick(s.keywords.filter(k => sameKind(k.kind, kind)))
         || (KIND_FALLBACK[kind] && pick(s.keywords.filter(k => sameKind(k.kind, KIND_FALLBACK[kind]))))
         || pick(s.keywords.filter(k => k.kind == null));
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
  const key = txKey(edgeKind(e));
  // a type left empty on purpose uses its keyword; an unknown type uses the عنعنة sentence
  return key in map ? map[key] || null : map.null || null;
}

// gender of the narrator (from) and the shaykh (to) of a link; me → my setting; unknown → M
const fromGender = (e, s) => (isMe(e.from_person_id) ? s.style.myGender : e.from_gender) === 'F' ? 'F' : 'M';
const toGender = e => (e.to_gender === 'F' ? 'F' : 'M');

// one phrase per edge; `opening` marks the first link of the whole isnad
function renderLinks(edges, s, ctx, { opening = true } = {}) {
  return edges.map((e, i) => {
    const first = opening && i === 0;
    const mine = first && isMe(e.from_person_id);
    const genders = { 'الراوي': fromGender(e, s), 'الشيخ': toGender(e) };
    const titleWord = genders['الشيخ'] === 'F' ? s.style.firstTitleF : s.style.firstTitle;
    const title = mine && titleWord ? `${titleWord} ` : '';
    const who = `${title}${personLabel(e.to_person_id, e.to_name, e.to_death_year, e.to_description, s, ctx)}`;

    const phrase = phraseFor(e, mine, s);
    if (phrase) {
      // «قرأتُ على شيخنا فلان حفظاً»
      const mode = mine && s.style.hideMyReadingMode ? null : { heart: s.style.heartWord, looking: s.style.lookingWord }[e.reading_mode];
      return applyGender(phrase, genders).replace(NAME_SLOT, mode ? `${who} ${mode}` : who);
    }

    const kw = keywordFor(edgeKind(e), s);
    const qala = s.style.qala && !first && !ANAN.has(kw) ? (genders['الراوي'] === 'F' ? 'قالت: ' : 'قال: ') : '';
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
 * tx_kind (or tx_name), to_death_year?, to_description? }.
 * If the chain starts at me (person 0) the speaker is implicit: «أخبرنا شيخنا فلان، عن فلان…».
 */
function renderChain(edges, settings) {
  return renderChainWith(edges, mergeSettings(settings), newContext());
}

const pid = e => String(e.to_person_id);
const chainKey = c => c.map(pid).join('>');

// number of leading links shared by every chain
function sharedHead(chains) {
  const min = Math.min(...chains.map(c => c.length));
  let n = 0;
  while (n < min && chains.every(c => pid(c[n]) === pid(chains[0][n]))) n++;
  return n;
}

// number of trailing links shared by every chain (each chain keeps at least one link of its own)
function sharedTail(chains) {
  const min = Math.min(...chains.map(c => c.length));
  let k = 0;
  while (k < min && chains.every(c => pid(c[c.length - 1 - k]) === pid(chains[0][chains[0].length - 1 - k]))) k++;
  return Math.min(k, min - 1);
}

const joinWord = (count, allF) => (count === 2 ? (allF ? 'كلتاهما' : 'كلاهما') : (allF ? 'كلهن' : 'كلهم'));

/**
 * Alternative chains → one isnad text with تحويل, factoring shared parts recursively:
 *  - a shared beginning is written once, then the branches restart from its last person («ح وعن فلان»);
 *  - chains that meet again are grouped by the narrator who reaches the meeting point, each group
 *    written the same way, then «كلاهما / كلهم عن X» and the shared rest.
 * scope: { opening: chains start at me (first-person link), restart: name to restart from after ح }
 */
const MAX_DEPTH = 40; // safety net: never recurse without end, whatever the data

function renderSet(chains, s, ctx, scope) {
  const sep = s.style.separator;
  const depth = (scope.depth || 0) + 1;
  const linear = c => renderLinks(c, s, ctx, { opening: scope.opening }).join(sep);
  const seen = new Set();
  const list = chains.filter(c => { const k = chainKey(c); if (seen.has(k)) return false; seen.add(k); return true; });
  const live = list.filter(c => c.length);
  if (!live.length) return '';
  if (list.length === 1) return linear(list[0]);
  const restartText = t => (scope.restart ? `${s.style.tahwil} وعن ${scope.restart}${t ? sep + t : ''}` : `${s.style.tahwil} و${t}`);
  const joinBranches = texts => texts.map((t, i) => (i === 0 ? t : restartText(t))).join(' ');
  if (depth > MAX_DEPTH) return joinBranches(live.map(linear));

  // 1. shared beginning
  const n = sharedHead(list);
  if (n > 0) {
    const head = renderLinks(list[0].slice(0, n), s, ctx, { opening: scope.opening }).join(sep);
    const rest = renderSet(list.map(c => c.slice(n)), s, ctx, { opening: false, restart: list[0][n - 1].to_name, depth });
    return [head, rest].filter(Boolean).join(sep);
  }

  // a chain that already ended here: its last person (the restart) narrates straight on
  const ended = list.length !== live.length;
  const branches = live.length === 1 ? [linear(live[0])] : null;

  // 2. shared ending: group the heads by the narrator who reaches the meeting point
  const k = branches || ended ? 0 : sharedTail(live);
  const heads = k ? live.map(c => c.slice(0, c.length - k)) : live;
  let texts = branches;
  if (!texts) {
    const groups = new Map();
    heads.forEach(h => { const key = pid(h[h.length - 1]); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(h); });
    if (groups.size === 1 && !k) {
      // Every route reaches the same shaykh and one of them is a single direct link
      // («قرأتُ على ابن قدامة» and «قرأتُ على ابن آجروم، وهو قرأ على ابن قدامة»): nothing more to
      // factor here, so write the direct routes, then let the longer ones factor among themselves.
      const direct = heads.filter(h => h.length === 1);
      const longer = heads.filter(h => h.length > 1);
      texts = [...direct.map(linear), ...(longer.length ? [renderSet(longer, s, ctx, { ...scope, depth })] : [])];
    } else {
      texts = [...groups.values()].map(g => renderSet(g, s, ctx, { ...scope, depth }));
    }
  }
  let text = joinBranches(texts);
  if (ended && scope.restart) text += ` ${restartText('')}`;
  if (!k) return text;

  const tail = live[0].slice(live[0].length - k);
  const narrators = new Map(live.map(c => [pid(c[c.length - k - 1]), c[c.length - k]]));
  // all routes reach the same narrator first: no «كلاهما», just carry on from him
  if (narrators.size === 1) return [text, ...renderLinks(tail, s, ctx, { opening: false })].join(sep);
  const allF = [...narrators.values()].every(e => fromGender(e, s) === 'F');
  const x = tail[0];
  const who = personLabel(x.to_person_id, x.to_name, x.to_death_year, x.to_description, s, ctx);
  // «كلاهما سمع من فلان» when every narrator took from X the same way, else «كلاهما عن فلان»
  const txs = new Set(live.map(c => txKey(edgeKind(c[c.length - k]))));
  const joined = s.style.clear && txs.size === 1 ? s.phrases.joined?.[[...txs][0]] : null;
  const meet = `${joinWord(narrators.size, allF)} ${joined
    ? applyGender(joined, { 'الراوي': allF ? 'F' : 'M', 'الشيخ': toGender(x) }).replace(NAME_SLOT, who)
    : `عن ${who}`}`;
  const after = renderLinks(tail.slice(1), s, ctx, { opening: false });
  return [text, meet, ...after].join(sep);
}

/** Several alternative chains → one text using تحويل (see renderSet). */
function renderChains(chains, settings) {
  const s = mergeSettings(settings);
  const ctx = newContext();
  const list = (chains || []).filter(c => c?.length);
  if (!list.length) return '';
  const first = list[0][0];
  if (isMe(first.from_person_id)) return renderSet(list, s, ctx, { opening: true, restart: null });
  // chains starting at a named narrator: name them once, restart from them after ح
  const start = personLabel(first.from_person_id, first.from_name, first.from_death_year, null, s, ctx);
  return `${start} ${renderSet(list, s, ctx, { opening: true, restart: first.from_name })}`;
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
