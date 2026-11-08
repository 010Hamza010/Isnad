const { mergeSettings } = require('./settings');
const { isMe } = require('./normalize');

const sameTx = (a, b) => (a == null ? null : Number(a)) === (b == null ? null : Number(b));
const pick = list => list.find(k => k.preferred) || list[0];

/** The keyword to write for a transmission type; falls back to the عنعنة form. */
function keywordFor(txTypeId, s) {
  const k = pick(s.keywords.filter(k => sameTx(k.tx_type_id, txTypeId)))
         || pick(s.keywords.filter(k => k.tx_type_id == null));
  if (!k) return 'عن';
  return s.style.abbreviate && k.abbr ? k.abbr : k.word;
}

const ANAN = new Set(['عن']);

// "kw name" phrases for consecutive edges; `opening` marks the first link of the whole isnad
function renderLinks(edges, s, { opening = true } = {}) {
  return edges.map((e, i) => {
    const kw = keywordFor(e.transmission_type_id, s);
    const first = opening && i === 0;
    const title = first && isMe(e.from_person_id) && s.style.firstTitle ? `${s.style.firstTitle} ` : '';
    const qala = s.style.qala && !first && !ANAN.has(kw) ? 'قال: ' : '';
    return `${qala}${kw} ${title}${e.to_name}`;
  });
}

/**
 * One chain of edges → text.
 * Edges are ordered from the reader upward: { from_person_id, from_name, to_person_id, to_name, transmission_type_id }.
 * If the chain starts at me (person 0) the speaker is implicit: «أخبرنا شيخنا فلان، عن فلان…».
 */
function renderChain(edges, settings) {
  const s = mergeSettings(settings);
  if (!edges?.length) return '';
  const body = renderLinks(edges, s).join(s.style.separator);
  return isMe(edges[0].from_person_id) ? body : `${edges[0].from_name} ${body}`;
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
  const list = (chains || []).filter(c => c?.length);
  if (list.length <= 1) return renderChain(list[0] || [], s);

  const k = sharedTail(list);
  const heads = list.map(c => renderChain(c.slice(0, c.length - k), s));
  let text = heads.map((h, i) => (i === 0 ? h : `${s.style.tahwil} و${h}`)).join(' ');
  if (k) {
    const tail = list[0].slice(list[0].length - k);
    // the first shared link is replaced by «كلاهما عن X»
    const [, ...rest] = renderLinks(tail, s, { opening: false });
    const all = list.length === 2 ? 'كلاهما' : 'كلهم';
    text += s.style.separator + [`${all} عن ${tail[0].to_name}`, ...rest].join(s.style.separator);
  }
  return text;
}

/** A path group as returned by /api/graph/*\/paths → text. */
function renderGroup(group, settings) {
  const chains = group.chains?.length
    ? group.chains.map(c => [group.firstEdge, ...c])
    : [[group.firstEdge]];
  return renderChains(chains, settings);
}

module.exports = { renderChain, renderChains, renderGroup, keywordFor };
