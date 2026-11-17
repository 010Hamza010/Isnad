/**
 * Chains of links → isnad prose. Pure: settings (keywords, sentences, style) come from the caller.
 * Full walkthrough with examples: ./README.md.
 *
 *   1. words      keywordFor, deathLabel, phraseFor               the word or sentence for one link
 *   2. persons    newContext, nameOf, personLabel                 a name as written (case, title, ت, note)
 *   3. one chain  renderLinks, renderAlso, placeRead, cutChain,   one phrase per link; «أيضاً» restarts;
 *                 renderChain                                     Quran stops and «بإسناده المتقدم»
 *   4. تحويل      renderSet (+ sharedHead, sharedTail,             several routes → one text: shared
 *                 restartWith, meetText, renderTogether,           beginning once, «ح وعن فلان»,
 *                 renderSiblings, togetherBuckets)                 «كلاهما عن X» where routes meet
 *   network       renderNetwork (+ networkable, networkRefers,     matn isnads: each link written once,
 *                 togetherAt, siblingsAt)                          «كلاهما» where links meet, ح only where a
 *                                                                 route waits for another (README § 5)
 *   «المتقدم»     splitRefers, referText                          my link to someone already written through
 *                                                                 a teacher: «وأرويه أيضاً … بسنده المتقدم»
 *   5. entry      renderChains, renderRoutes, renderGroup,
 *                 groupChains, collectPersons
 *
 * An edge is one link, from the student (from_*) up to the shaykh (to_*); person 0 is me.
 * Its fields are listed in README.md § «Edge».
 */
const { mergeSettings } = require('./settings');
const { isMe } = require('./normalize');
const { applyGender } = require('./gender');
const { fullName, inflect, caseAfter } = require('./names');

const { kindOf } = require('../txKinds');

// ── 1. words ──────────────────────────────────────────────────────────────

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

// ── 2. persons ────────────────────────────────────────────────────────────

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

// the name as written: full (kunya in the right case + nisba) when style.fullNames; else as stored,
// a leading أبو / أبي / أبا in the case («عن شيخنا أبي عبيدة»)
function nameOf(p, s, ctx, kase) {
  const name = s.style.fullNames && Number(p.id) > 0 ? fullName(p, kase) : Number(p.id) > 0 ? inflect(p.name, kase) : p.name;
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

const NAME_SLOT = '{الاسم}';   // the shaykh's place in a sentence

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
    const plain = applyGender(phrase, genders).replace(ALSO_SLOT, `${viaTitle}${nameOf(toP(via), s, ctx, 'nom')}`);
    const placed = placeRead(plain, readOf(e));
    const text = placed ?? plain;
    return ALSO_MARK + text.replace(NAME_SLOT, `${personLabel(toP(e), s, ctx, caseAfter(text.split(NAME_SLOT)[0]))}${placed == null ? readWith(e) : ''}`);
  }
  // keyword form: the classical restart «ح وعن فلان، عن …»
  const kw = keywordFor(edgeKind(e), s);
  return `عن ${viaTitle}${nameOf(toP(via), s, ctx, 'gen')}${s.style.separator}${kw} ${personLabel(toP(e), s, ctx, caseAfter(kw))}`;
}

// ── 3. one chain ──────────────────────────────────────────────────────────

/*
 * One phrase per edge; `opening` marks the first link of a route (my own link gets the first-person
 * sentence and «شيخنا»). When the route's first links are already in the text (ctx.written), it
 * starts from the last of them with renderAlso: «وقرأ شيخنا أ أيضاً على ج».
 */
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
      // «قرأتُ بقراءة عاصم على شيخنا فلان حفظاً»
      const mode = mine && s.style.hideMyReadingMode ? null : { heart: s.style.heartWord, looking: s.style.lookingWord }[e.reading_mode];
      const plain = applyGender(phrase, genders);
      const placed = placeRead(plain, readOf(e));
      const text = placed ?? plain;
      const who = `${label(caseAfter(text.split(NAME_SLOT)[0]))}${placed == null ? readWith(e) : ''}`;
      return text.replace(NAME_SLOT, mode ? `${who} ${mode}` : who);
    }

    const kw0 = keywordFor(edgeKind(e), s);
    const kwPlaced = placeRead(`${kw0} ${NAME_SLOT}`, readOf(e));
    const kw = kwPlaced ? kwPlaced.split(NAME_SLOT)[0].trim() : kw0;
    const who = `${label(caseAfter(kw))}${kwPlaced ? '' : readWith(e)}`;
    const qala = s.style.qala && !first && !ANAN.has(kw) ? (genders['الراوي'] === 'F' ? 'قالت: ' : 'قال: ') : '';
    return `${qala}${kw} ${who}`;                             // «أخبرنا شيخنا فلان، عن فلان»
  }).map((t, i) => `${t}${edges[i].noteAfter || ''}`);
}

/*
 * What was read on a link (Quran ijaza: «بقراءة عاصم», «بالقراءات العشر الصغرى», «بها»), set by the
 * caller on any link: written before «على» — «قرأ بقراءة عاصم على فلان» — or, when the wording has
 * no «على» before the name, after the name.
 */
const readOf = e => (e?.read_with ? String(e.read_with).trim().slice(0, 300) : '');
const readWith = e => (readOf(e) ? ` ${readOf(e)}` : '');
function placeRead(text, read) {
  if (!read) return text;
  const [before, ...rest] = text.split(NAME_SLOT);
  if (!rest.length || !/على\s*$/.test(before)) return null;
  return `${before.replace(/\s*على\s*$/, ` ${read} على `)}${NAME_SLOT}${rest.join(NAME_SLOT)}`;
}
// the same read on every link, else ''
const sharedRead = edges => (edges.every(e => readOf(e) === readOf(edges[0])) ? readOf(edges[0]) : '');

/** Where a Quran chain stops: the imam's sanad to the Prophet ﷺ is not entered yet. */
const munqatiNote = e => `[لم يُدخَل بعدُ سند ${/^الإمام\s/.test(e.to_name || '') ? '' : 'الإمام '}${e.to_name} إلى النبي ﷺ]`;

/**
 * Where a Quran chain is cut, the link before is written with a note after it:
 *  - a made-up «منقطع» jump (quranChain: imam → النبي ﷺ): «… نافع. [لم يُدخَل بعدُ سند …]», no fake
 *    step to the Prophet ﷺ and no جبريل tail;
 *  - the stop of a group's isnad (quranGroupIsnad): «… ابن الجزري، بأسانيده … إلى الأئمة».
 */
function cutChain(chain0, s) {
  // «… على شيخنا فلان بإسناده المتقدم [إلى ابن الجزري، وهو قرأ على …]» (several paragraphs): the
  // refer step is written after the link before it, the chain goes on after it
  const chain = [];
  chain0.forEach(e => {
    if (e?.refer && chain.length) chain[chain.length - 1] = { ...chain[chain.length - 1], noteAfter: ` ${String(e.note || '').trim().slice(0, 300)}` };
    else if (!e?.refer) chain.push(e);
  });
  const i = chain.findIndex(e => e?.munqati || e?.group_stop);
  if (i <= 0) return chain;
  const prev = chain[i - 1];
  const note = String(chain[i].note || '').trim();
  const noteAfter = chain[i].munqati ? `. ${munqatiNote(prev)}` : note ? `${s.style.separator}${note}` : '';
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

// ── 4. تحويل ──────────────────────────────────────────────────────────────

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
// done: that route went all the way (to the author): a whole isnad, so «.» and a new paragraph, no ح
function restartWith(t, s, scope, ctx, prevWords = 0, done = false) {
  const also = t.startsWith(ALSO_MARK);
  const body = also ? t.slice(ALSO_MARK.length) : t;
  const long = s.style.longRestart && s.style.longRestartWords > 0 && prevWords >= s.style.longRestartWords;
  if (long || done) {
    const br = done ? '.\n\n' : `${s.style.tahwil}\n\n`;
    if (also) return `${br}و${body}`;                       // «وقرأ شيخنا فلان أيضاً على …» says it already
    if (scope.restart) {
      const verb = scope.restart.gender === 'F' ? 'وترويه' : 'ويرويه';
      return `${br}${verb} أيضاً ${nameOf(scope.restart, s, ctx, 'nom')}${body ? s.style.separator + body : ''}`;
    }
    return `${br}${s.style.longRestart || DEFAULTS_RESTART}: ${body}`;
  }
  return scope.restart
    ? `${s.style.tahwil} وعن ${nameOf(scope.restart, s, ctx, 'gen')}${body ? s.style.separator + body : ''}`
    : `${s.style.tahwil} و${body}`;
}
const DEFAULTS_RESTART = 'وأرويه أيضاً';
// scope.before: words written before these branches on the same route (a shared beginning)
// done: every branch goes all the way (see restartWith)
const joinBranchTexts = (texts, s, scope, ctx, done = false) => texts
  .map((t, i) => (i === 0 ? t : restartWith(t, s, scope, ctx, wordCount(texts[i - 1]) + (i === 1 ? scope.before || 0 : 0), done)))
  .join(' ').replace(/ (\.?)\n\n/g, '$1\n\n');

// «كلاهما قرأ على X» when every narrator took from X the same way, else «كلاهما عن X».
// meetEdges: one edge into X per narrator.
function meetText(meetEdges, s, ctx) {
  const allF = meetEdges.every(e => fromGender(e, s) === 'F');
  const x = meetEdges[0];
  const txs = new Set(meetEdges.map(e => txKey(edgeKind(e))));
  const joined = s.style.clear && txs.size === 1 ? s.phrases.joined?.[[...txs][0]] : null;
  const joinedPlain = joined && applyGender(joined, { 'الراوي': allF ? 'F' : 'M', 'الشيخ': toGender(x) });
  // «كلاهما قرأ بها على فلان» when they read the same on him; nothing when they differ
  const joinedText = joinedPlain && (placeRead(joinedPlain, sharedRead(meetEdges)) ?? joinedPlain);
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
  const plain = phrase ? applyGender(phrase, { 'الراوي': fromGender(firsts[0], s), 'الشيخ': allF ? 'F' : 'M' }) : keywordFor(edgeKind(firsts[0]), s);
  // the same read on all: once, before «على» («قرأتُ بقراءة عاصم على شيخنا A، وشيخنا B»); else after each name
  const shared = phrase ? placeRead(plain, sharedRead(firsts)) : null;
  const lead = shared ?? plain;
  const kase = caseAfter(phrase ? lead.split(NAME_SLOT)[0] : lead);
  const names = firsts.map(e => {
    const tw = toGender(e) === 'F' ? s.style.firstTitleF : s.style.firstTitle;
    return `${tw ? `${tw} ` : ''}${personLabel(toP(e), s, ctx, kase)}${shared != null && sharedRead(firsts) ? '' : readWith(e)}`;
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

/*
 * Several routes → one text (recursive). Steps, in order (README.md § 4 has an example of each):
 *   0. identical routes dropped; one route left → written straight
 *   1. a beginning shared by all → written once, the rest restarts from its last person («ح وعن أ»)
 *   2. an ending shared by all (k links from the meeting person X); the narrators are who reach X:
 *      2a. my teachers, taken the same way, straight to X → «قرأتُ على أ، وب، كلاهما قرأ على X»
 *      2b. one shaykh's teachers straight to X           → «… على ب، وعلى ج، كلاهما قرأ على X»
 *      2c. routes parting at once, meeting only later     → split where they part (حفص / شعبة)
 *      2d. tahwilMeet 'repeat' (default)                  → branches by narrator, each naming X, «ح», then the tail
 *   3. otherwise (no shared ending, or tahwilMeet 'joined') → branches by their last person, then
 *      «كلاهما عن X» and the tail when there is one
 * Limitation: only what ALL the routes of a call share is factored. Forks in the middle make the
 * cross product of routes, and their shared parts are written once per combination; matn isnads go
 * through renderNetwork instead (README.md § 5).
 * scope: { opening, restart (person to name after ح), before (words already on this route), depth,
 *          complete (false when the routes were cut at a meeting person: they do not reach the end) }
 */
function renderSet(chains, s, ctx, scope) {
  const sep = s.style.separator;
  const depth = (scope.depth || 0) + 1;
  const linear = c => renderLinks(c, s, ctx, { opening: scope.opening }).join(sep);
  const seen = new Set();
  const list = chains.filter(c => { const k = chainKey(c); if (seen.has(k)) return false; seen.add(k); return true; });
  const live = list.filter(c => c.length);
  if (!live.length) return '';
  if (list.length === 1) return linear(list[0]);                  // 0. one route
  const whole = scope.complete !== false;           // these routes go all the way (not cut at a meeting)
  const joinBranches = (texts, done = false) => joinBranchTexts(texts, s, scope, ctx, done);
  if (depth > MAX_DEPTH) return joinBranches(live.map(linear), whole);

  // 1. shared beginning
  const n = sharedHead(list);
  if (n > 0) {
    const head = renderLinks(list[0].slice(0, n), s, ctx, { opening: scope.opening }).join(sep);
    const rest = renderSet(list.map(c => c.slice(n)), s, ctx, { opening: false, restart: toP(list[0][n - 1]), before: (scope.before || 0) + wordCount(head), depth, complete: scope.complete });
    return [head, rest].filter(Boolean).join(sep);
  }

  // a chain that already ended here: its last person (the restart) narrates straight on
  const ended = list.length !== live.length;

  // 2. shared ending: group the heads by the narrator who reaches the meeting point
  //    (k = shared links, X = live[i][len - k]; none when a route already ended here)
  const k = live.length === 1 || ended ? 0 : sharedTail(live);
  const narrators = new Map(k ? live.map(c => [pid(c[c.length - k - 1]), c[c.length - k]]) : []);
  const tailAfter = () => renderLinks(live[0].slice(live[0].length - k + 1), s, ctx, { opening: false });
  // branches cut at the meeting person X still go all the way when nothing comes after X (k = 1)
  const toEnd = whole && k === 1;

  if (narrators.size > 1) {
    const toMeet = live.map(c => c.slice(0, c.length - k + 1));
    const from = String(toMeet[0][0].from_person_id);
    const siblings = toMeet.every(c => c.length === 2 && String(c[0].from_person_id) === from && !ctx.written.has(linkKey(c[0])));
    // 2a. I took from each of my teachers the same way and they all meet: «قرأتُ على A، وB، كلاهما قرأ على X» — no ح
    if (siblings && isMe(from)) {
      const [bucket] = togetherBuckets(toMeet, ctx);
      if (bucket && bucket.length === live.length) {
        return [renderTogether(bucket.map(c => c[0]), s, ctx), meetText(bucket.map(c => c[1]), s, ctx), ...tailAfter()].join(sep);
      }
    }
    // 2b. a shaykh's own teachers who all meet: «… عن A، عن B، وعن C، كلاهما عن D» — no ح
    if (siblings && !isMe(from)) {
      return [renderSiblings(toMeet.map(c => c[0]), s, ctx), meetText(toMeet.map(c => c[1]), s, ctx), ...tailAfter()].join(sep);
    }
  }

  // 2c. Routes that part right away and meet again only later (حفص's and شعبة's, each through its own
  // sahaba up to النبي ﷺ): split where they part when that makes fewer branches than splitting at the
  // meeting — «… السلمي، وهو قرأ على عثمان، وعلى علي…، كلهم قرأ على النبي ﷺ ح وعن زيد… زر…، كلهم قرأ على النبي ﷺ، …»
  if (narrators.size > 1) {
    const byFirst = new Map();
    live.forEach(c => {
      const key = pid(c[0]);
      if (!byFirst.has(key)) byFirst.set(key, []);
      byFirst.get(key).push(c.slice(0, c.length - k + 1));
    });
    if (byFirst.size > 1 && byFirst.size < narrators.size) {
      const texts = [...byFirst.values()].map(g => renderSet(g, s, ctx, { ...scope, depth, complete: toEnd }));
      return [joinBranches(texts, toEnd), ...tailAfter()].join(sep);
    }
  }

  if (narrators.size > 1 && s.style.tahwilMeet !== 'joined') {
    // 2d. every branch names the meeting person X: «A عن B عن X ح وD عن E عن X، عن G».
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
      if (!b) { texts.push(renderSet(g, s, ctx, { ...scope, depth, complete: toEnd })); return; }
      if (b[0] !== g[0]) return; // written with the first of its bucket
      texts.push([renderTogether(b.map(c => c[0]), s, ctx), meetText(b.map(c => c[1]), s, ctx)].join(sep));
    });
    return [joinBranches(texts, toEnd), ...tailAfter()].join(sep);
  }
  // 3. branches by their last person (before the shared ending, if any)
  const branches = live.length === 1 ? [linear(live[0])] : null;
  const heads = k ? live.map(c => c.slice(0, c.length - k)) : live;
  const sub = { ...scope, depth, complete: whole && !k };   // with a shared ending the branches stop before it
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
      texts = [...direct.map(linear), ...(longer.length ? [renderSet(longer, s, ctx, sub)] : [])];
    } else {
      texts = [...groups.values()].map(g => renderSet(g, s, ctx, sub));
    }
  }
  let text = joinBranches(texts, sub.complete);
  if (ended && scope.restart) text = `${text} ${restartWith('', s, scope, ctx, wordCount(text) + (scope.before || 0))}`.replace(/ \n\n/g, '\n\n');
  if (!k) return text;

  const tail = live[0].slice(live[0].length - k);
  // all routes reach the same narrator first: no «كلاهما», just carry on from him
  if (narrators.size === 1) return [text, ...renderLinks(tail, s, ctx, { opening: false })].join(sep);
  const meet = meetText([...narrators.values()], s, ctx);
  const after = renderLinks(tail.slice(1), s, ctx, { opening: false });
  return [text, meet, ...after].join(sep);
}

// ── «بسنده المتقدم» ───────────────────────────────────────────────────────

/*
 * My own link to X, when X's sanad is already written through one of my teachers (X further up a
 * route that does not start with my link to him): instead of writing X's chain again, one sentence
 * after the isnad (phrases.refer): «وأرويه أيضاً سماعاً من شيخنا X بسنده المتقدم». When my route above
 * X parts from the written one after at least MIN_REFER links: «… بسنده المتقدم إلى Y، وهو قرأ على …».
 * → { keep: routes written as usual, refers: [{ chain, shared }] } (shared: links the same above X)
 * A route whose X is only found in other such routes, or several routes of X parting differently,
 * stay in `keep`.
 */
const MIN_REFER = 2;
function splitRefers(list) {
  const ids = c => c.map(pid);
  const isCandidate = c => c.length > 1 && isMe(c[0].from_person_id)
    && list.some(d => ids(d).indexOf(pid(c[0])) >= 1);
  const sources = list.filter(c => !isCandidate(c));
  const byX = new Map();
  const keep = [...sources];
  list.filter(isCandidate).forEach(c => {
    const x = pid(c[0]);
    const rest = ids(c).slice(1);
    let best = 0;
    let whole = false;
    sources.forEach(d => {
      const D = ids(d);
      const j = D.indexOf(x);
      if (j < 1) return;
      let n = 0;
      while (n < rest.length && D[j + 1 + n] === rest[n]) n++;
      best = Math.max(best, n);
      if (n === rest.length && j + 1 + n === D.length) whole = true;
    });
    if (!whole && best < MIN_REFER) { keep.push(c); return; }
    if (!byX.has(x)) byX.set(x, { whole: null, partial: [] });
    const g = byX.get(x);
    if (whole) g.whole = g.whole || c; else g.partial.push({ chain: c, shared: best });
  });
  const refers = [];
  byX.forEach(g => {
    if (g.whole) refers.push({ chain: g.whole, shared: g.whole.length - 1 });
    if (g.partial.length === 1) refers.push(g.partial[0]);
    else g.partial.forEach(p => keep.push(p.chain));       // several ways of parting: written in full
  });
  // keep the routes in their original order
  return { keep: list.filter(c => keep.includes(c)), refers };
}

// «وأرويه أيضاً سماعاً من شيخنا X بسنده المتقدم[ إلى Y، وهو قرأ على …]»
function referText({ chain, shared }, s, ctx) {
  const e = chain[0];
  const map = s.phrases.refer || {};
  const key = txKey(edgeKind(e));
  const phrase = (key in map ? map[key] : null) || map.null || 'وأرويه أيضاً عن {الاسم} {الشيخ:بسنده|بسندها} المتقدم';
  const plain = applyGender(phrase, { 'الراوي': fromGender(e, s), 'الشيخ': toGender(e) });
  const titleWord = toGender(e) === 'F' ? s.style.firstTitleF : s.style.firstTitle;
  const who = `${titleWord ? `${titleWord} ` : ''}${nameOf(toP(e), s, ctx, caseAfter(plain.split(NAME_SLOT)[0]))}`;
  ctx.written.add(linkKey(e));
  let text = plain.replace(NAME_SLOT, who);
  if (shared < chain.length - 1) {
    const y = chain[shared];                                    // the last person the same as before
    const rest = renderLinks(chain.slice(shared + 1), s, ctx, { opening: false });
    text += ` إلى ${nameOf(toP(y), s, ctx, 'gen')}${s.style.separator}${rest.join(s.style.separator)}`;
  }
  return text;
}

// ── network: each link written once ───────────────────────────────────────

/*
 * Matn isnads (routes from me to one person, no Quran notes): written from the NETWORK of links,
 * not route by route, so a link is never written twice.
 *  - my teachers taken the same way who share a shaykh: «قرأتُ على شيخنا A، وشيخنا B، كلاهما سمع من X»
 *  - a shaykh whose shaykhs (each reached only through him) meet at once: «عن B، وعن C، كلاهما عن D»
 *  - a route reaching someone another route has still to reach stops there with ح; the last route
 *    to arrive goes on («… عن ابن العابد ح وقرأ شيخنا عمار أيضاً على …، عن ابن العابد، عن ابن ثابت …»)
 *  - another shaykh of someone already written: «ح وعن فلان، عن …» (from my teacher: «وقرأ شيخنا فلان أيضاً على …»)
 *  - a route reaching the end (the author) closes an isnad: never ح after it; the next starts a
 *    paragraph («وأرويه أيضاً: …», «وقرأ شيخنا فلان أيضاً …», «ويرويه أيضاً فلان، عن …»)
 *  - my teacher with at most one person of his own before someone written through another teacher:
 *    after the isnad, «وأرويه أيضاً سماعاً من شيخنا X[، عن Y] بسنده المتقدم» (networkRefers)
 * Returns null when it does not apply (or the data surprises it): the route-by-route writer is used.
 */
const ME = '0';
const ek = (f, t) => `${f}>${t}`;

function buildNetwork(list) {
  const E = new Map(), out = new Map(), inn = new Map(), person = new Map();
  const add = (m, key, v) => { if (!m.has(key)) m.set(key, []); if (!m.get(key).includes(v)) m.get(key).push(v); };
  list.forEach(c => c.forEach(e => {
    const f = String(e.from_person_id), t = pid(e);
    if (!E.has(ek(f, t))) E.set(ek(f, t), e);
    add(out, f, t); add(inn, t, f);
    if (!person.has(t)) person.set(t, toP(e));
  }));
  return { E, out: v => out.get(v) || [], inn: v => inn.get(v) || [], person };
}

const networkable = (list, s) => s.style.tahwilMeet !== 'joined'
  && list.every(c => isMe(c[0].from_person_id))
  && new Set(list.map(c => pid(c[c.length - 1]))).size === 1
  && list.every(c => c.every(e => !e.read_with && !e.noteAfter));

// nodes reachable from `starts` (included) over the edges kept by `ok`
function reachFrom(net, starts, ok = () => true) {
  const seen = new Set(starts);
  const todo = [...starts];
  while (todo.length) {
    const v = todo.pop();
    net.out(v).forEach(t => { if (ok(v, t) && !seen.has(t)) { seen.add(t); todo.push(t); } });
  }
  return seen;
}

// my teachers (in order) taken the same way who share a shaykh w → { as, w } for teacher X, or null
function togetherAt(net, X, mine, usable) {
  const way = e => sameWay(e);
  const same = mine.filter(Y => way(net.E.get(ek(ME, Y))) === way(net.E.get(ek(ME, X))));
  let best = null;
  net.out(X).filter(w => usable(X, w)).forEach(w => {
    const as = same.filter(Y => net.out(Y).includes(w) && usable(Y, w));
    if (as.length > 1 && (!best || as.length > best.as.length)) best = { as, w };
  });
  return best;
}

/*
 * My teachers whose route has at most one person of its own before someone reached through my other
 * teachers, and whose whole rest is written by those: «بسنده المتقدم». Later teachers first, so the
 * earlier ones keep their routes; a teacher written together with others never.
 */
function networkRefers(net, T) {
  const mine = net.out(ME);
  const grouped = new Set();
  mine.forEach(X => { const g = togetherAt(net, X, mine, () => true); if (g) g.as.forEach(Y => grouped.add(Y)); });
  const kept = new Set(mine);
  const refers = [];
  [...mine].reverse().forEach(X => {
    if (grouped.has(X) || X === T) return;
    const others = [...kept].filter(t => t !== X);
    if (!others.length) return;
    const R = reachFrom(net, others.flatMap(t => net.out(t)));
    const ownOne = !R.has(X) && net.out(X).length === 1 && R.has(net.out(X)[0]) && net.out(X)[0] !== T;
    if (!R.has(X) && !ownOne) return;
    // every link above the join must be written by the other routes
    const from = ownOne ? net.out(X) : [X];
    const covered = reachFrom(net, others);
    const sub = reachFrom(net, from);
    const allIn = [...sub].every(v => net.out(v).every(t => covered.has(v) && covered.has(t)));
    if (!allIn) return;
    kept.delete(X);
    refers.push({ first: net.E.get(ek(ME, X)), via: ownOne ? net.E.get(ek(X, net.out(X)[0])) : null });
  });
  return { kept: mine.filter(X => kept.has(X)), refers: refers.reverse() };
}

// «وأرويه أيضاً إجازةً عامةً عن شيخنا X، عن Y بسنده المتقدم»
function networkReferText({ first, via }, s, ctx) {
  const map = s.phrases.refer || {};
  const key = txKey(edgeKind(first));
  const phrase = (key in map ? map[key] : null) || map.null || 'وأرويه أيضاً عن {الاسم} {الشيخ:بسنده|بسندها} المتقدم';
  const plain = applyGender(phrase, { 'الراوي': fromGender(first, s), 'الشيخ': toGender(via || first) });
  const titleWord = toGender(first) === 'F' ? s.style.firstTitleF : s.style.firstTitle;
  let who = `${titleWord ? `${titleWord} ` : ''}${nameOf(toP(first), s, ctx, caseAfter(plain.split(NAME_SLOT)[0]))}`;
  ctx.written.add(linkKey(first));
  if (via) who += `${s.style.separator}${renderLinks([via], s, ctx, { opening: false })[0]}`;
  return plain.replace(NAME_SLOT, who);
}

function renderNetwork(list, s, ctx) {
  const net = buildNetwork(list);
  const T = pid(list[0][list[0].length - 1]);
  // a loop in the data (A above B and B above A): not a network to walk
  const state = new Map();
  const loops = v => {
    if (state.get(v) === 1) return true;
    if (state.get(v) === 2) return false;
    state.set(v, 1);
    const bad = net.out(v).some(loops);
    state.set(v, 2);
    return bad;
  };
  if (loops(ME)) return null;
  // the network must not invent a route: every path through it is one of the routes given (true for
  // a matn; not for the Quran, where عاصم gave حفص his riwaya through السلمي and شعبة through زر, nor
  // when some routes were switched off)
  const paths = new Map();
  const count = v => {
    if (v === T) return 1;
    if (!paths.has(v)) paths.set(v, net.out(v).reduce((n, t) => n + count(t), 0));
    return paths.get(v);
  };
  if (count(ME) !== new Set(list.map(chainKey)).size) return null;

  const { kept, refers } = networkRefers(net, T);
  // the links written: those on the routes of the teachers kept
  const active = new Set();
  reachFrom(net, kept).forEach(v => net.out(v).forEach(t => active.add(ek(v, t))));
  kept.forEach(X => active.add(ek(ME, X)));
  const usable = (f, t) => active.has(ek(f, t)) && !written.has(ek(f, t));
  const written = new Set();
  const mark = e => written.add(ek(String(e.from_person_id), pid(e)));
  const pending = v => net.inn(v).some(f => active.has(ek(f, v)) && !written.has(ek(f, v)));
  const edge = (f, t) => net.E.get(ek(f, t));
  const sep = s.style.separator;
  const stack = [];   // deferred: another shaykh of someone written { u, v, kind: 'also' | 'deep' }
  const defer = (u, v) => stack.push({ u, v, kind: active.has(ek(ME, u)) ? 'also' : 'deep' });

  // a shaykh's shaykhs reached only through him that meet at once → { as, w }
  const siblingsAt = (v, outs) => {
    let best = null;
    outs.filter(a => net.inn(a).filter(f => active.has(ek(f, a))).length === 1).forEach(a => net.out(a).forEach(w => {
      if (!usable(a, w)) return;
      const as = outs.filter(b => net.inn(b).filter(f => active.has(ek(f, b))).length === 1 && usable(b, w));
      if (as.length > 1 && (!best || as.length > best.as.length)) best = { as, w };
    }));
    return best;
  };

  // after a group meets at w: the group's other shaykhs wait their turn
  const writeGroup = (parts, v, g, opening) => {
    const firsts = g.as.map(a => edge(v, a));
    const meets = g.as.map(a => edge(a, g.w));
    parts.push(opening ? renderTogether(firsts, s, ctx) : renderSiblings(firsts, s, ctx), meetText(meets, s, ctx));
    [...firsts, ...meets].forEach(mark);
    g.as.forEach(a => net.out(a).filter(b => usable(a, b)).reverse().forEach(b => defer(a, b)));
    return g.w;
  };

  // from x (just reached): stop at the end or where another route has still to arrive; else go on
  const goOn = (x, parts) => {
    for (let guard = 0; guard < 500; guard++) {
      if (x === T) return { end: 'T' };
      if (pending(x)) return { end: 'wait', node: x };
      const outs = net.out(x).filter(t => usable(x, t));
      if (!outs.length) return { end: 'T' };
      const g = siblingsAt(x, outs);
      if (g) {
        outs.filter(a => !g.as.includes(a)).reverse().forEach(a => defer(x, a));
        x = writeGroup(parts, x, g, false);
      } else {
        const [a, ...rest] = outs;
        rest.reverse().forEach(b => defer(x, b));
        parts.push(...renderLinks([edge(x, a)], s, ctx, { opening: false }));
        mark(edge(x, a));
        x = a;
      }
    }
    return null;
  };

  const runTask = task => {
    const parts = [];
    let x;
    if (task.kind === 'root') {
      const g = togetherAt(net, task.v, kept.filter(Y => usable(ME, Y)), usable);
      if (g && g.as.includes(task.v)) x = writeGroup(parts, ME, g, true);
      else { parts.push(...renderLinks([edge(ME, task.v)], s, ctx, { opening: true })); mark(edge(ME, task.v)); x = task.v; }
    } else if (task.kind === 'also') {
      parts.push(renderAlso(edge(task.u, task.v), edge(ME, task.u), s, ctx));
      mark(edge(task.u, task.v)); x = task.v;
    } else {
      parts.push(...renderLinks([edge(task.u, task.v)], s, ctx, { opening: false }));
      mark(edge(task.u, task.v)); x = task.v;
    }
    const r = goOn(x, parts);
    return r && { ...task, ...r, text: parts.join(sep) };
  };

  // next route: one that reaches where the last one stopped; else the latest deferred, else my next teacher
  const pick = last => {
    for (let i = stack.length - 1; i >= 0; i--) if (!usable(stack[i].u, stack[i].v)) stack.splice(i, 1);
    const roots = kept.filter(X => usable(ME, X)).map(X => ({ u: ME, v: X, kind: 'root' }));
    const order = [...[...stack].reverse(), ...roots];
    if (last?.end === 'wait') {
      const hit = order.find(t => reachFrom(net, [t.v], usable).has(last.node));
      if (hit) { const i = stack.indexOf(hit); if (i >= 0) stack.splice(i, 1); return hit; }
    }
    const t = order[0];
    if (t && stack.includes(t)) stack.splice(stack.indexOf(t), 1);
    return t;
  };

  const segs = [];
  for (let task = pick(null), guard = 0; task && guard < 1000; task = pick(segs[segs.length - 1]), guard++) {
    const seg = runTask(task);
    if (!seg) return null;
    segs.push(seg);
  }
  if ([...active].some(k => !written.has(k))) return null;   // something not written: let the old writer do it

  let text = segs[0].text;
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i], prev = segs[i - 1];
    if (seg.kind === 'deep') {
      // «ح وعن فلان، …»; after a route reaching the end never ح: «. ويرويه أيضاً فلان، عن …»
      text += ` ${restartWith(seg.text, s, { restart: net.person.get(seg.u) }, ctx, 0, prev.end === 'T')}`;
    } else {
      // from me or my teacher: after a whole isnad a new paragraph, else ح (a paragraph after a long route)
      text += ` ${restartWith(seg.text, s, { restart: null }, ctx, wordCount(prev.text), prev.end === 'T')}`;
    }
  }
  text = text.replace(/ (\.?)\n\n/g, '$1\n\n').split(ALSO_MARK).join('');
  return [text, ...refers.map(r => networkReferText(r, s, ctx))].join('.\n\n');
}

// ── 5. entry points ───────────────────────────────────────────────────────

/**
 * Several alternative chains → one text using تحويل (see renderSet). The chains are cut first
 * (cutChain). Routes not starting at me name their first person once and restart from him after ح.
 * ctx: pass one newContext() to read back the names written and the persons noted.
 */
function renderChains(chains, settings, ctx = newContext()) {
  const s = mergeSettings(settings);
  const list = (chains || []).filter(c => c?.length).map(c => cutChain(c, s));
  if (!list.length) return '';
  // matn isnads: from the network of links (each link once); else route by route
  if (networkable(list, s)) {
    // on a scratch context, so a fallback starts clean
    const tmp = newContext({ authorId: ctx.authorId });
    const net = renderNetwork(list, s, tmp);
    if (net != null) {
      ['noted', 'names', 'authorNames', 'written'].forEach(k => tmp[k].forEach(x => ctx[k].add(x)));
      return net;
    }
  }
  // my link to someone already written through a teacher: «… بسنده المتقدم» after the isnad
  const { keep, refers } = splitRefers(list);
  return [renderRoutes(keep, s, ctx), ...refers.map(r => referText(r, s, ctx))].join('.\n\n');
}

// the routes (already cut) → text with تحويل
function renderRoutes(list, s, ctx) {
  const first = list[0][0];
  const clean = t => t.split(ALSO_MARK).join('');
  // routes that all end at one person (the matn's author, the imam…) are whole isnads: one that gets
  // there ends with «.» and the next starts a paragraph, without ح (see restartWith)
  const complete = new Set(list.map(c => pid(c[c.length - 1]))).size === 1;
  if (isMe(first.from_person_id)) return clean(renderSet(list, s, ctx, { opening: true, restart: null, complete }));
  // chains starting at a named narrator: name them once, restart from them after ح
  const start = personLabel(fromP(first), s, ctx);
  return clean(`${start} ${renderSet(list, s, ctx, { opening: true, restart: fromP(first), complete })}`);
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
