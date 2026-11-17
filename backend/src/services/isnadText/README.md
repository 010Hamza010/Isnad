# isnadText — chains ↔ isnad prose

This module turns **chains of links** into an **isnad in Arabic** («قرأتُ على شيخنا فلان، وهو قرأ على …
ح وعن …»). It also reads such prose back into chains (fast entry, imports). Everything here is
**pure**: no database access. The words, the gender forms and the style come from the user's settings.

| File | Role |
|---|---|
| `index.js` | Public entry: re-exports everything below. Adds `toEdges` (parsed chain → edges, so a parse can be rendered back). |
| `render.js` | **Chains → text**, including تحويل (ح), «كلاهما», «أيضاً», notes, death years. |
| `parse.js` | Text → chains of `{ keyword, tx_kind, name }`. |
| `resolve.js` | Parsed names → persons in the DB (`resolveName`: matched / ambiguous / new / relative). |
| `names.js` | Full names for the detailed ijaza (kunya in its case + nisba), and `caseAfter` (genitive after عن/على/من…). |
| `gender.js` | `{الراوي:وهو قرأ\|وهي قرأت}` alternations, by the narrator, the shaykh or the student. |
| `normalize.js` | Arabic normalisation for matching (`normalizeArabic`), names (`nameKey`: ابن = بن), keywords (`keyOf`: keeps ى ≠ ي). |
| `defaults.js` | Default keywords, style and sentences (see [Settings](#settings)). |
| `settings.js` | Merges stored settings over the defaults, validates them, upgrades old formats. |
| `vocabulary.js` | Phrases the parser recognises (`LINK_FORMS`, `MANNERS`). |
| `legacy.json` | Old defaults, to upgrade settings saved by earlier versions. |

Tests: `backend/test/isnadText.test.js` (unit), `pipeline.test.js` (parse → render), `realData.test.js`
(real isnads), `fullNames.test.js`, `quranChain.test.js`, `quranGroupIsnad.test.js`.

---

## 1. Where the chains come from

```
 links in the DB (matn_connections / quran_connections)
        │
        ▼
 graphService.buildPaths          every complete route from me (person 0) to the target
 (services/graphService.js)       (the matn's author, or the rawi / imam / النبي ﷺ for the Quran),
        │                         by depth-first search; grouped by my first link:
        │                         [{ firstEdge, chains: [[edge…], …] }]
        ▼
 disabledRoutes.applyDisabled     drops the routes the user switched off
        │
        ▼   GET /graph/matn/:id/paths · /graph/quran/paths · /graph/quran/group-paths
 ┌──────┴───────────────────────────────────────────────┐
 │ isnad pages (components/isnad/IsnadText.jsx)          │ ijaza page (pages/ijazat/NewIjaza.jsx)
 │  POST /isnad-text/render { group }                    │  groupsToChains: all groups → one flat list
 │  → one text per first shaykh (renderGroup)            │  of full chains, in the teachers' order
 │                                                       │  (Quran) withReads: «بقراءة عاصم» on each link
 │                                                       │  referEarlier: «بإسناده المتقدم» across paragraphs
 │                                                       │  POST /isnad-text/render { chains, style, authorId }
 │                                                       │  twice: normal, and fullNames (detailed version)
 └──────┬───────────────────────────────────────────────┘
        ▼
 render.renderChains   → text          isnadText controller: controllers/isnadTextController.js
```

**The render receives every complete route separately, not the network of links.** Two forks
one after the other make four routes. For a matn the renderer rebuilds the network from them (§ 5);
otherwise it finds the shared parts route by route (§ 4).

### Edge (one link), as the renderer reads it

Built by `graphService.formatEdge`, ordered **from me upward** (`from` is the student, `to` the shaykh):

```js
{
  from_person_id, from_name, from_gender, from_kunya, from_nisba, from_death_year,
  to_person_id,   to_name,   to_gender,   to_kunya,   to_nisba,   to_death_year, to_description,
  tx_kind,          // transmission kind: 'qiraa' | 'sama' | 'lafz' | 'ijaza' | … | null (عنعنة)  — see ../txKinds.js
  reading_mode,     // 'heart' (غيباً) | 'looking' (نظراً) | null
  general, items, books, groups, is_general,   // matn «عام» / Quran data (not used for the wording)
  // set by the caller, optional:
  read_with,        // Quran: what was read on this link, «بقراءة عاصم» / «بها» (frontend withReads)
  munqati,          // Quran: a made-up imam → النبي ﷺ jump (services/quranChain)
  group_stop, note, // Quran group isnad: stop here and write `note` (services/quranGroupIsnad)
  refer, note,      // «بإسناده المتقدم …» step inserted by frontend referEarlier
}
```

Person `0` is **me**: the first link of a chain starting at 0 is written in the first person («قرأتُ على شيخنا»).
Negative ids are the fixed persons (النبي ﷺ −1, جبريل −2, رب العزة −3).

---

## 2. Settings

`mergeSettings(stored)` → `{ keywords, style, phrases, titles, honorifics, fillers }`. The user edits
them in «الإعدادات ← صيغ الإسناد». Everything is keyed by transmission **kind**, never by a type id.

- **`keywords`**: the short forms used when `style.clear` is off («أخبرنا», «حدثنا», «عن»…).
  The `preferred` one of a kind is written. A kind without a keyword borrows one (`KIND_FALLBACK`
  in `render.js`), else «عن».
- **`phrases`**: the clear sentences, used when `style.clear` is on (the ijaza turns it on). `{الاسم}` is the shaykh.
  - `first`: my own link, «قرأتُ على {الاسم}».
  - `others`: every link above, «{الراوي:وهو قرأ|وهي قرأت} على {الاسم}».
  - `joined`: after «كلاهما / كلهم», «{الراوي:قرأ|قرأت} على {الاسم}».
  - `also`: a branch restarting from someone already named, «{الراوي:قرأ|قرأت} {الراوي} أيضاً على {الاسم}».
  - `refer`: my own link to someone whose sanad is already written through a teacher, «وأرويه أيضاً سماعاً من {الاسم} {الشيخ:بسنده|بسندها} المتقدم» (see § 4).
- **`style`** (the ones that shape تحويل):

| Key | Default | Effect |
|---|---|---|
| `tahwil` | `ح` | The marker between alternative routes. |
| `separator` | `، ` | Between links. |
| `tahwilMeet` | `repeat` | Routes that meet later: `repeat` writes the meeting person in every branch («… عن ط ح و… عن ط، عن ي»); `joined` writes «… ح و…، كلاهما عن ط، عن ي». |
| `longRestart` / `longRestartWords` | `وأرويه أيضاً` / 30 | After a branch of 30+ words, the next one starts a new paragraph: «… ح ⏎ وأرويه أيضاً: …», or «ويرويه أيضاً فلان، …» part-way up. `''` = always «ح». |
| `firstTitle` / `firstTitleF` | `شيخنا` / `شيختنا` | Before my own shaykh's name. |
| `clear` | false | Sentences (`phrases`) instead of keywords. |
| `deathYears` | false | «فلان (ت 852هـ)». |
| `noteMarkers` | false | `[[id]]` after a person's first mention; the ijaza turns them into footnotes. |
| `fullNames` | false | Kunya (in its case) + nisba, for the detailed ijaza. |
| `authorTitle` | `المؤلف` | «عن المؤلف فلان» before the matn's author. |
| `hideMyReadingMode` | false | Leave «غيباً من حفظي» out of my link (the teachers paragraph says it). |
| `abbreviate`, `qala` | false | «ثنا / أنا», «قال:» before each keyword. |

---

## 3. Writing one chain

`renderLinks(edges, s, ctx, { opening })` writes one phrase per link, joined by `separator`:

- **My link** (`opening` and from 0): `phrases.first` + title: «قرأتُ على شيخنا أ».
- **Links above:** `phrases.others`: «وهو قرأ على ب». In keyword mode: «أخبرنا ب».
- **The case of the name** comes from the word before it (`caseAfter`): «عن **أبي** بكر», «وهو **أبو** بكر».
  It only changes the name when `fullNames` is on (see `nameOf`).
- **`personLabel`** adds the author title, the death year and the note marker.
- **`read_with`** (`placeRead`) goes before «على»: «قرأ بقراءة عاصم على فلان».
- **Already written** (`ctx.written`): if a branch's first links are already in the text, it starts
  from the last of them with `renderAlso`: «وقرأ شيخنا أ أيضاً على ج».

`cutChain` runs first on every chain. It handles the Quran stops (`munqati` → «[لم يُدخَل بعدُ سند …]»,
`group_stop` → its note) and the `refer` steps («بإسناده المتقدم»).

**The context** (`newContext`) is shared by all the chains of one text:

| Field | Holds |
|---|---|
| `written` | Links already written, so a later branch says «أيضاً». |
| `noted` | Persons who already got a note marker. |
| `names`, `authorNames` | Every name as written, for colouring them in the certificate. |
| `authorId` | The matn's author, for «المؤلف». |

---

## 4. تحويل: several routes → one text (`renderChains` → `renderSet`)

`renderChains(chains, settings, ctx)` does three things:

1. It cuts the chains (`cutChain`).
   For a matn isnad it then writes from the network of links (§ 5) and stops there.
2. Otherwise it sets aside my links whose sanad is already written (`splitRefers`, see «بسنده المتقدم» below).
3. It renders the other routes (`renderRoutes` → `renderSet(list, s, ctx, { opening: true, restart: null, complete })`).
   If they start at another person (not me), it writes that person once and restarts from them after ح.

`complete` is true when every route ends at the same person: the matn's author, the imam, or a group's stop.

**«بسنده المتقدم»** (`splitRefers`, `referText`). Take my own link to X, where X also appears further
up a route that starts with another teacher of mine. My route is then not written again. After the
isnad («.» and a new paragraph) comes one sentence from `phrases.refer`, in the word for how I took
it and in X's gender:

> `أنا→ابن آجروم→ابن قدامة→ابن الجزري→النبي ﷺ`, `أنا→ابن قدامة→ابن الجزري→النبي ﷺ`<br>
> «قرأتُ على ابن آجروم، وهو قرأ على ابن قدامة، وهو قرأ على ابن الجزري، وهو قرأ على النبي ﷺ.<br>
> وأرويه أيضاً قراءةً على ابن قدامة بسنده المتقدم»

| Case | Result |
|---|---|
| My route above X is the same as the written one, to the end | «… بسنده المتقدم» |
| It parts after at least 2 links the same (`MIN_REFER`) | «… بسنده المتقدم إلى ب، وهو قرأ على د، …» |
| Fewer links the same; X is the last person (the author); X only written in routes that are themselves like this; several ways of parting | Written in full, as before |

`renderSet` is **recursive**. At each call it looks at the list of chains it was given, in this order:

**0. Trivial cases.** It drops identical chains. One chain left → write it linearly.

**1. Shared beginning** (`sharedHead`): links that all the chains share at the start are written
once. The rest is rendered recursively, with `restart` = the last shared person, so the next branch
says «ح وعن أ».

> chains `أنا→أ→ب→ج`, `أنا→أ→د→هـ`<br>
> «قرأتُ على شيخنا أ، وهو قرأ على ب، وهو قرأ على ج **ح وعن أ**، وهو قرأ على د، وهو قرأ على هـ»

**2. Shared ending** (`sharedTail`, k links): the chains end the same way. The «narrators» are the
people who reach the meeting person X (the first link of the tail), one per chain. Several cases follow.

**2a. My teachers, taken the same way, all reach X directly** → one sentence, no ح (`renderTogether` + `meetText`):

> `أنا→أ→ج→د`, `أنا→ب→ج→د`<br>
> «قرأتُ على شيخنا أ، وشيخنا ب، **كلاهما قرأ على ج**، وهو قرأ على د»

**2b. One shaykh's own teachers all reach X directly** → «وعلى …» (`renderSiblings` + `meetText`):

> `أنا→أ→ب→د→هـ`, `أنا→أ→ج→د→هـ` (after step 1 removed «أ»)<br>
> «قرأتُ على شيخنا أ، وهو قرأ على ب، **وعلى ج، كلاهما قرأ على د**، وهو قرأ على هـ»

**2c. Routes that part at once and meet only later** (the حفص / شعبة case): if grouping by the
first person gives fewer branches than grouping by the narrators, it splits there and writes the
tail once.

**2d. Meeting after longer branches, `tahwilMeet: 'repeat'`** (the default): it groups the chains
by narrator. Each group is rendered recursively up to X, the groups are joined with ح, and then
the tail follows:

> `أنا→أ→ب→ج→ط→ي`, `أنا→د→هـ→و→ط→ي`<br>
> «قرأتُ على شيخنا أ، وهو قرأ على ب، وهو قرأ على ج، وهو قرأ على ط **ح** وقرأتُ على شيخنا د، وهو قرأ على هـ، وهو قرأ على و، وهو قرأ على ط، وهو قرأ على ي»

My teachers taken the same way are still put together inside it (`togetherBuckets`).

**3. Otherwise** (no shared ending, or `tahwilMeet: 'joined'`): it groups the heads by their last
person and renders each group recursively. A group whose routes all reach the same shaykh and
include a direct link writes the direct link first:

> `أنا→ج`, `أنا→أ→ج`<br>
> «قرأتُ على شيخنا ج **ح** وقرأتُ على شيخنا أ، وهو قرأ على ج»

Then, if there was a shared ending, comes «كلاهما عن X» (`meetText`) and the rest:

> `joined`: «… وهو قرأ على ج **ح** وقرأتُ على شيخنا د، …، وهو قرأ على و، **كلاهما قرأ على ط**، وهو قرأ على ي»

**Joining the branches** (`joinBranchTexts` → `restartWith`). Each branch after the first starts with:

| Case | Start |
|---|---|
| The branch before **reached the end** (the author: `complete`) | «.» ends it: a whole isnad. A new paragraph starts without ح: «وأرويه أيضاً: …», «ويرويه أيضاً فلان، …», or the «أيضاً» sentence |
| A shared beginning was written | «ح وعن فلان، …» |
| Otherwise | «ح و…» |
| The branch before had `longRestartWords`+ words | «ح» ends the paragraph, and a new one starts: «وأرويه أيضاً: …», or «ويرويه أيضاً فلان، …» part-way up |
| The branch starts with an «أيضاً» sentence (`ALSO_MARK`) | That sentence alone: «ح وقرأ شيخنا أ أيضاً على ج» |

A branch only reaches the end when its call's routes were not cut at a meeting person. The
exception is a meeting with the last person himself (k = 1). `scope.complete` carries this down the
recursion: steps 2c / 2d pass `k === 1`, and step 3 passes `!k`.

`MAX_DEPTH` (40) stops the recursion on looping data. Past it, the branches are written one after the other.

---

## 5. Matn isnads: the network writer (`renderNetwork`)

`renderSet` only factors what **all** the routes of a call share at the start or at the end. Routes
that fork, meet, then fork again are the cross product of the forks, and their middle would be
written once per combination: on one real thabat, 81 links made 25 routes, or 507 links to write.

So `renderChains` first tries to write from the **network** of links: each link once. Conditions
(`networkable`, then checks inside `renderNetwork`); otherwise the route-by-route writer above is used:

| Condition | Why |
|---|---|
| Every route starts at me and ends at the same person | One isnad to walk from me to the end. |
| No Quran data on the links (`read_with`, notes, «بإسناده المتقدم» steps) | The Quran keeps the route writer for now. |
| `tahwilMeet` is `repeat` (the default) | `joined` not done yet. |
| No loop in the links | |
| **Every path through the network is one of the routes given** | Otherwise the network would invent a route. Not true for the Quran (عاصم gave حفص his riwaya through السلمي and شعبة through زر), nor when routes were switched off. |
| Every link got written | Safety net: anything else, the old writer. |

**How it walks** (each step is a «task»; the text of a task is a segment):

| Situation | Text |
|---|---|
| My teachers taken the same way who share a shaykh (`togetherAt`) | «قرأتُ على شيخنا زياد، وشيخنا عمار، كلاهما سمع من وهب» |
| A shaykh's shaykhs, each reached only through him, meeting at once (`siblingsAt`) | «عن نوفل، عن ربيع، وعن شريح، كلاهما عن عامر» |
| Reaching someone another route has still to reach | Stop with ح. **The last route to arrive goes on**: «… عن يحيى ح وقرأ شيخنا عمار أيضاً على ثابت، … عن يحيى، عن يوسف …» |
| Someone with several shaykhs | The first goes on now; the others wait (a stack). |
| Next task after a stop | One that reaches where the last route stopped; else the latest waiting one; else my next teacher (in order). |
| Restart from my teacher | «وقرأ شيخنا عمار أيضاً على …» (phrases.also) |
| Restart from someone deeper | «ح وعن فلان، عن …» |
| Any restart after a route reached the end | **Never ح.** «.» and a new paragraph: «وأرويه أيضاً: …», «وقرأ شيخنا زياد أيضاً على سهل …», «ويرويه أيضاً هاشم، عن إدريس، …» |

**«بسنده المتقدم»** (`networkRefers`). My teacher X goes to the end of the isnad as one sentence
when two things hold:

1. **At most one person of his own:** X himself, or his single shaykh Y, is reached through my other teachers.
2. **The whole rest is written by those teachers.**

My teachers written together with others never qualify, and later teachers are tested first.

> «وأرويه أيضاً سماعاً من شيخنا سهل بسنده المتقدم»<br>
> «وأرويه أيضاً عن شيخنا عطاء، عن وهب بسنده المتقدم»

A route with more of its own (هند: ten people before قاسم) is a branch of the تحويل instead.

**Example** (`README` § 4 cross product):<br>
> «قرأتُ على شيخنا أ، وشيخنا ب، كلاهما قرأ على ج، وهو قرأ على د، وعلى هـ، كلاهما قرأ على و، وهو قرأ على ز»

Tests: `test/isnadText.test.js` «network: each link written once».

**Still route by route:** the Quran, the `joined` setting, and routes switched off. There, forks in the
middle are still written once per combination.

## 6. Parsing (text → chains)

`parseIsnad(text, settings)` does the following:

1. It takes the death years out («(ت 852هـ)») and tokenises the text (`normalize.tokenize`),
   stripping the honorifics.
2. It splits off a shared tail introduced by «كلاهما / كلهم», then splits the rest into heads at
   the tahwil marker.
3. In each part (`parseSegment`) it finds the keywords, the clear sentences in every gender form
   (`phrases.first` / `others`, plus `vocabulary.LINK_FORMS`) and the reading manners after a name
   (`MANNERS`). It strips titles and fillers from the names.
4. «عن B، وعن C» inside a head becomes two chains (`expandAlternatives`). The shared tail is added
   to every head.

It returns `{ chains: [{ start, start_death_year, links: [{ name, tx_kind, reading_mode, death_year }] }], warnings }`.
`resolveChains` then matches every name against the persons (`resolve.js`). The scores are:

| Match | Score |
|---|---|
| Exact name (`nameKey`) | 1 |
| Every word of the name found in the person's name / kunya / nisba | 0.5–0.9 |
| The name contained in the person's name | 0.4 |

A clear winner is `matched`. Otherwise it's `ambiguous` (candidates offered) or `new`.
