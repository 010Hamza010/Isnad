const { mergeSettings } = require('./settings');
const { isMe } = require('./normalize');
const { applyGender } = require('./gender');
const { fullName, caseAfter } = require('./names');

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
// noted: persons given a note marker; names / authorNames: names as written (for colouring);
// written: links already in the text («from>to»), so a later branch says «وقرأ فلان أيضاً على…»
const newContext = ({ authorId = null } = {}) => ({ noted: new Set(), names: new Set(), authorNames: new Set(), written: new Set(), authorId });
const linkKey = e => `${e.from_person_id}>${e.to_person_id}`;

// the two people of an edge as { id, name, kunya, nisba, death, desc }
const toP = e => ({ id: e.to_person_id, name: e.to_name, kunya: e.to_kunya, nisba: e.to_nisba, death: e.to_death_year, desc: e.to_description, gender: e.to_gender });
const fromP = e => ({ id: e.from_person_id, name: e.from_name, kunya: e.from_kunya, nisba: e.from_nisba, death: e.from_death_year, desc: null, gender: e.from_gender });

// the name as written: full (kunya in the right case + nisba) when style.fullNames
function nameOf(p, s, ctx, kase) {
  const name = s.style.fullNames && Number(p.id) > 0 ? fullName(p, kase) : p.name;
  ctx.names.add(name);
  return name;
}

// «name (ت …)[[id]]»; kase: 'nom' | 'gen', from the word before the name
function personLabel(p, s, ctx, kase = 'nom') {
  const { id, death, desc } = p;
  let out = nameOf(p, s, ctx, kase);
  // the author of the matn at the end of the isnad: «عن المؤلف فلان»
  if (ctx.authorId != null && Number(id) === Number(ctx.authorId) && Number(id) > 0) {
    ctx.authorNames.add(out);
    if (s.style.authorTitle) { out = `${s.style.authorTitle} ${out}`; ctx.authorNames.add(out); }
  }
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

const ALSO_SLOT = '{الراوي}';
const ALSO_MARK = '\u0001'; // prefixes a branch rendered by renderAlso (already says «أيضاً»); removed from the final text

// «قرأ شيخنا فلان أيضاً على {الاسم}» — a branch that starts from someone already in the text
function renderAlso(e, via, s, ctx) {
  const genders = { 'الراوي': fromGender(e, s), 'الشيخ': toGender(e) };
  const viaTitleWord = isMe(via.from_person_id) ? (toGender(via) === 'F' ? s.style.firstTitleF : s.style.firstTitle) : '';
  const viaTitle = viaTitleWord ? `${viaTitleWord} ` : '';
  const phrase = s.style.clear ? (s.phrases.also?.[txKey(edgeKind(e))] || s.phrases.also?.null) : null;
  ctx.written.add(linkKey(e));
  if (phrase) {
    const text = applyGender(phrase, genders).replace(ALSO_SLOT, `${viaTitle}${nameOf(toP(via), s, ctx, 'nom')}`);
    return ALSO_MARK + text.replace(NAME_SLOT, personLabel(toP(e), s, ctx, caseAfter(text.split(NAME_SLOT)[0])));
  }
  // keyword form: the classical restart «ح وعن فلان، عن …»
  const kw = keywordFor(edgeKind(e), s);
  return `عن ${viaTitle}${nameOf(toP(via), s, ctx, 'gen')}${s.style.separator}${kw} ${personLabel(toP(e), s, ctx, caseAfter(kw))}`;
}

// one phrase per edge; `opening` marks the first link of the whole isnad
function renderLinks(edges, s, ctx, { opening = true } = {}) {
  // a new branch whose first links are already written starts from the last of them, with «أيضاً»
  let skip = 0;
  if (opening) while (skip < edges.length - 1 && ctx.written.has(linkKey(edges[skip]))) skip++;
  if (skip) {
    return [renderAlso(edges[skip], edges[skip - 1], s, ctx), ...renderLinks(edges.slice(skip + 1), s, ctx, { opening: false })];
  }
  return edges.map((e, i) => {
    ctx.written.add(linkKey(e));
    const first = opening && i === 0;
    const mine = first && isMe(e.from_person_id);
    const genders = { 'الراوي': fromGender(e, s), 'الشيخ': toGender(e) };
    const titleWord = genders['الشيخ'] === 'F' ? s.style.firstTitleF : s.style.firstTitle;
    const title = mine && titleWord ? `${titleWord} ` : '';
    const label = kase => `${title}${personLabel(toP(e), s, ctx, kase)}`;

    const phrase = phraseFor(e, mine, s);
    if (phrase) {
      // «قرأتُ على شيخنا فلان حفظاً»
      const mode = mine && s.style.hideMyReadingMode ? null : { heart: s.style.heartWord, looking: s.style.lookingWord }[e.reading_mode];
      const text = applyGender(phrase, genders);
      const who = label(caseAfter(text.split(NAME_SLOT)[0]));
      return text.replace(NAME_SLOT, mode ? `${who} ${mode}` : who);
    }

    const kw = keywordFor(edgeKind(e), s);
    const who = label(caseAfter(kw));
    const qala = s.style.qala && !first && !ANAN.has(kw) ? (genders['الراوي'] === 'F' ? 'قالت: ' : 'قال: ') : '';
    return `${qala}${kw} ${who}`;                             // «أخبرنا شيخنا فلان، عن فلان»
  }).map((t, i) => `${t}${edges[i].noteAfter || ''}`);
}

/** Where a Quran chain stops: the imam's sanad to the Prophet ﷺ is not entered yet. */
const munqatiNote = e => `[لم يُدخَل بعدُ سند ${/^الإمام\s/.test(e.to_name || '') ? '' : 'الإمام '}${e.to_name} إلى النبي ﷺ]`;

/**
 * Where a Quran chain is cut, the link before is written with a note after it:
 *  - a made-up «منقطع» jump (quranChain: imam → النبي ﷺ): «… نافع. [لم يُدخَل بعدُ سند …]», no fake
 *    step to the Prophet ﷺ and no جبريل tail;
 *  - the stop of a group's isnad (quranGroupIsnad): «… ابن الجزري، بأسانيده … إلى الأئمة».
 */
function cutChain(chain, s) {
  const i = chain.findIndex(e => e?.munqati || e?.group_stop);
  if (i <= 0) return chain;
  const prev = chain[i - 1];
  const noteAfter = chain[i].munqati ? `. ${munqatiNote(prev)}` : `${s.style.separator}${String(chain[i].note || '').trim()}`;
  return [...chain.slice(0, i - 1), { ...prev, noteAfter }];
}

function renderChainWith(edges, s, ctx) {
  if (!edges?.length) return '';
  const body = renderLinks(edges, s, ctx).join(s.style.separator);
  if (isMe(edges[0].from_person_id)) return body;
  const start = personLabel(fromP(edges[0]), s, ctx);
  return `${start} ${body}`;
}

/**
 * One chain of edges → text.
 * Edges are ordered from the reader upward: { from_person_id, from_name, to_person_id, to_name,
 * tx_kind (or tx_name), to_death_year?, to_description? }.
 * If the chain starts at me (person 0) the speaker is implicit: «أخبرنا شيخنا فلان، عن فلان…».
 */
function renderChain(edges, settings) {
  const s = mergeSettings(settings);
  return renderChainWith(cutChain(edges || [], s), s, newContext());
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

const wordCount = t => String(t).replace(/\[\[-?\d+\]\]/g, '').split(/\s+/).filter(Boolean).length;

/*
 * The next branch: «ح وعن فلان، …» after a shared beginning, else «ح و…».
 * After a long branch (style.longRestartWords) «ح» ends the line and the new route starts a paragraph,
 * so the reader sees where it begins: from me «… ح ⏎ وأرويه أيضاً: قرأتُ على …»; part-way up, from
 * فلان already in the text, «… ح ⏎ ويرويه أيضاً فلان، عن …» («وترويه» for a woman) — never «وأرويه».
 */
// prevWords: length of the route the reader has just read (since the last restart)
function restartWith(t, s, scope, ctx, prevWords = 0) {
  const also = t.startsWith(ALSO_MARK);
  const body = also ? t.slice(ALSO_MARK.length) : t;
  const long = s.style.longRestart && s.style.longRestartWords > 0 && prevWords >= s.style.longRestartWords;
  if (long) {
    const br = `${s.style.tahwil}\n\n`;
    if (also) return `${br}و${body}`;                       // «وقرأ شيخنا فلان أيضاً على …» says it already
    if (scope.restart) {
      const verb = scope.restart.gender === 'F' ? 'وترويه' : 'ويرويه';
      return `${br}${verb} أيضاً ${nameOf(scope.restart, s, ctx, 'nom')}${body ? s.style.separator + body : ''}`;
    }
    return `${br}${s.style.longRestart}: ${body}`;
  }
  return scope.restart
    ? `${s.style.tahwil} وعن ${nameOf(scope.restart, s, ctx, 'gen')}${body ? s.style.separator + body : ''}`
    : `${s.style.tahwil} و${body}`;
}
// scope.before: words written before these branches on the same route (a shared beginning)
const joinBranchTexts = (texts, s, scope, ctx) => texts
  .map((t, i) => (i === 0 ? t : restartWith(t, s, scope, ctx, wordCount(texts[i - 1]) + (i === 1 ? scope.before || 0 : 0))))
  .join(' ').replace(/ \n\n/g, '\n\n');

// «كلاهما قرأ على X» when every narrator took from X the same way, else «كلاهما عن X».
// meetEdges: one edge into X per narrator.
function meetText(meetEdges, s, ctx) {
  const allF = meetEdges.every(e => fromGender(e, s) === 'F');
  const x = meetEdges[0];
  const txs = new Set(meetEdges.map(e => txKey(edgeKind(e))));
  const joined = s.style.clear && txs.size === 1 ? s.phrases.joined?.[[...txs][0]] : null;
  const joinedText = joined && applyGender(joined, { 'الراوي': allF ? 'F' : 'M', 'الشيخ': toGender(x) });
  meetEdges.forEach(e => ctx.written.add(linkKey(e)));
  const who = personLabel(toP(x), s, ctx, joinedText ? caseAfter(joinedText.split(NAME_SLOT)[0]) : 'gen');
  const note = x.noteAfter || '';
  return `${joinWord(meetEdges.length, allF)} ${joinedText ? joinedText.replace(NAME_SLOT, who) : `عن ${who}`}${note}`;
}

// «قرأتُ على شيخنا A، وشيخنا B» — my own teachers taken the same way, in one sentence
function renderTogether(firsts, s, ctx) {
  firsts.forEach(e => ctx.written.add(linkKey(e)));
  const allF = firsts.every(e => toGender(e) === 'F');
  const phrase = phraseFor(firsts[0], true, s);
  const lead = phrase ? applyGender(phrase, { 'الراوي': fromGender(firsts[0], s), 'الشيخ': allF ? 'F' : 'M' }) : keywordFor(edgeKind(firsts[0]), s);
  const kase = caseAfter(phrase ? lead.split(NAME_SLOT)[0] : lead);
  const names = firsts.map(e => {
    const tw = toGender(e) === 'F' ? s.style.firstTitleF : s.style.firstTitle;
    return `${tw ? `${tw} ` : ''}${personLabel(toP(e), s, ctx, kase)}`;
  }).join(`${s.style.separator}و`);
  if (!phrase) return `${lead} ${names}`;
  const mode = s.style.hideMyReadingMode ? null : { heart: s.style.heartWord, looking: s.style.lookingWord }[firsts[0].reading_mode];
  return lead.replace(NAME_SLOT, mode ? `${names} ${mode}` : names);
}

/*
 * A shaykh (not me) who took from several shaykhs, all of whom took from one person:
 *   same way:       «وهو قرأ على B، وعلى C» / «عن B، وعن C»
 *   different ways: «وهو قرأ على B، وسمع من C» — each with its own verb
 * (followed by «كلاهما … D» from meetText). firsts: the links from that shaykh, in order.
 */
function renderSiblings(firsts, s, ctx) {
  firsts.forEach(e => ctx.written.add(linkKey(e)));
  const same = new Set(firsts.map(sameWay)).size === 1;
  const lastWord = t => String(t).trim().split(/\s+/).pop() || '';
  let tail = '';
  const parts = firsts.map((e, i) => {
    const genders = { 'الراوي': fromGender(e, s), 'الشيخ': toGender(e) };
    const mode = { heart: s.style.heartWord, looking: s.style.lookingWord }[e.reading_mode];
    const phrase = phraseFor(e, false, s);
    const [pre, post = ''] = phrase ? applyGender(phrase, genders).split(NAME_SLOT) : [keywordFor(edgeKind(e), s), ''];
    const who = `${personLabel(toP(e), s, ctx, caseAfter(pre))}${mode ? ` ${mode}` : ''}`;
    const prep = caseAfter(pre) === 'gen' ? lastWord(pre) : '';     // على / من / عن
    if (i === 0) {
      if (same) tail = post.trim();                                // «… وهو يسمع» once, after the last name
      return `${pre.trim()} ${who}${same ? '' : post}`.trim();
    }
    if (same) return prep ? `و${prep} ${who}` : `و${who}`;
    // its own verb without repeating the subject: «وهو سمع من» → «وسمع من»
    const verb = pre.trim().replace(/^(?:وهو|وهي)\s+/, '');
    return `${verb.startsWith('و') ? verb : `و${verb}`} ${who}${post}`.trim();
  });
  return `${parts.join(s.style.separator)}${tail ? ` ${tail}` : ''}`;
}

// chains (sliced to end at the meeting person) whose only link before it is mine, bucketed by how I took:
// a bucket of two or more is written together, without ح
const sameWay = e => `${txKey(edgeKind(e))}|${e.reading_mode || ''}`;
function togetherBuckets(branches, ctx) {
  const buckets = new Map();
  branches.forEach(c => {
    if (c.length !== 2 || !isMe(c[0].from_person_id) || ctx.written.has(linkKey(c[0]))) return;
    const key = sameWay(c[0]);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  });
  return [...buckets.values()].filter(b => b.length > 1);
}

function renderSet(chains, s, ctx, scope) {
  const sep = s.style.separator;
  const depth = (scope.depth || 0) + 1;
  const linear = c => renderLinks(c, s, ctx, { opening: scope.opening }).join(sep);
  const seen = new Set();
  const list = chains.filter(c => { const k = chainKey(c); if (seen.has(k)) return false; seen.add(k); return true; });
  const live = list.filter(c => c.length);
  if (!live.length) return '';
  if (list.length === 1) return linear(list[0]);
  const joinBranches = texts => joinBranchTexts(texts, s, scope, ctx);
  if (depth > MAX_DEPTH) return joinBranches(live.map(linear));

  // 1. shared beginning
  const n = sharedHead(list);
  if (n > 0) {
    const head = renderLinks(list[0].slice(0, n), s, ctx, { opening: scope.opening }).join(sep);
    const rest = renderSet(list.map(c => c.slice(n)), s, ctx, { opening: false, restart: toP(list[0][n - 1]), before: (scope.before || 0) + wordCount(head), depth });
    return [head, rest].filter(Boolean).join(sep);
  }

  // a chain that already ended here: its last person (the restart) narrates straight on
  const ended = list.length !== live.length;

  // 2. shared ending: group the heads by the narrator who reaches the meeting point
  const k = live.length === 1 || ended ? 0 : sharedTail(live);
  const narrators = new Map(k ? live.map(c => [pid(c[c.length - k - 1]), c[c.length - k]]) : []);
  const tailAfter = () => renderLinks(live[0].slice(live[0].length - k + 1), s, ctx, { opening: false });

  if (narrators.size > 1) {
    const toMeet = live.map(c => c.slice(0, c.length - k + 1));
    const from = String(toMeet[0][0].from_person_id);
    const siblings = toMeet.every(c => c.length === 2 && String(c[0].from_person_id) === from && !ctx.written.has(linkKey(c[0])));
    // I took from each of my teachers the same way and they all meet: «قرأتُ على A، وB، كلاهما قرأ على X» — no ح
    if (siblings && isMe(from)) {
      const [bucket] = togetherBuckets(toMeet, ctx);
      if (bucket && bucket.length === live.length) {
        return [renderTogether(bucket.map(c => c[0]), s, ctx), meetText(bucket.map(c => c[1]), s, ctx), ...tailAfter()].join(sep);
      }
    }
    // a shaykh's own teachers who all meet: «… عن A، عن B، وعن C، كلاهما عن D» — no ح
    if (siblings && !isMe(from)) {
      return [renderSiblings(toMeet.map(c => c[0]), s, ctx), meetText(toMeet.map(c => c[1]), s, ctx), ...tailAfter()].join(sep);
    }
  }

  if (narrators.size > 1 && s.style.tahwilMeet !== 'joined') {
    // every branch names the meeting person X: «A عن B عن X ح وD عن E عن X، عن G».
    // Branches are grouped by who reaches X, each group factored the same way (smaller sets: no loop).
    const groups = new Map();
    live.forEach(c => {
      const key = pid(c[c.length - k - 1]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c.slice(0, c.length - k + 1));
    });
    // my teachers taken the same way go together in one branch: «قرأتُ على A، وB، كلاهما قرأ على X ح …»
    const together = scope.opening ? togetherBuckets([...groups.values()].filter(g => g.length === 1).map(g => g[0]), ctx) : [];
    const inBucket = new Map(together.flatMap(b => b.map(c => [c, b])));
    const texts = [];
    [...groups.values()].forEach(g => {
      const b = g.length === 1 && inBucket.get(g[0]);
      if (!b) { texts.push(renderSet(g, s, ctx, { ...scope, depth })); return; }
      if (b[0] !== g[0]) return; // written with the first of its bucket
      texts.push([renderTogether(b.map(c => c[0]), s, ctx), meetText(b.map(c => c[1]), s, ctx)].join(sep));
    });
    return [joinBranches(texts), ...tailAfter()].join(sep);
  }
  const branches = live.length === 1 ? [linear(live[0])] : null;
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
  if (ended && scope.restart) text = `${text} ${restartWith('', s, scope, ctx, wordCount(text) + (scope.before || 0))}`.replace(/ \n\n/g, '\n\n');
  if (!k) return text;

  const tail = live[0].slice(live[0].length - k);
  // all routes reach the same narrator first: no «كلاهما», just carry on from him
  if (narrators.size === 1) return [text, ...renderLinks(tail, s, ctx, { opening: false })].join(sep);
  const meet = meetText([...narrators.values()], s, ctx);
  const after = renderLinks(tail.slice(1), s, ctx, { opening: false });
  return [text, meet, ...after].join(sep);
}

/** Several alternative chains → one text using تحويل (see renderSet). */
function renderChains(chains, settings, ctx = newContext()) {
  const s = mergeSettings(settings);
  const list = (chains || []).filter(c => c?.length).map(c => cutChain(c, s));
  if (!list.length) return '';
  const first = list[0][0];
  const clean = t => t.split(ALSO_MARK).join('');
  if (isMe(first.from_person_id)) return clean(renderSet(list, s, ctx, { opening: true, restart: null }));
  // chains starting at a named narrator: name them once, restart from them after ح
  const start = personLabel(fromP(first), s, ctx);
  return clean(`${start} ${renderSet(list, s, ctx, { opening: true, restart: fromP(first) })}`);
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

module.exports = { newContext, renderChain, renderChains, renderGroup, groupChains, collectPersons, keywordFor, deathLabel };
