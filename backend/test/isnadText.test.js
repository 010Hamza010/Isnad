const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const TT = require('../src/services/isnadText');
// most tests below were written for the «كلاهما عن …» form; the default «repeat» form is tested at the end
const joined = st => ({ ...(st || {}), style: { ...(st?.style || {}), tahwilMeet: 'joined' } });
const T = { ...TT, renderChains: (c, st, ctx) => TT.renderChains(c, joined(st), ctx), renderGroup: (g, st) => TT.renderGroup(g, joined(st)) };
const { SEED_KINDS: K } = require('../src/services/txKinds');
// tests below name transmissions with the seed numbering (1 سماع، 2 قراءة، 3 إجازة…) for brevity
const ID = Object.fromEntries(Object.entries(K).map(([id, kind]) => [kind, Number(id)]));
const idOf = kind => (kind == null ? null : ID[kind] ?? kind);

const e = (from, fromName, to, toName, tx = null) =>
  ({ from_person_id: from, from_name: fromName, to_person_id: to, to_name: toName, tx_kind: K[tx] ?? null });

// أنا ← الكتاني (قراءة) ← جعفر (عنعنة) ← إدريس (إجازة)
const CHAIN = [e(0, 'أنا', 1, 'محمد عبد الحي الكتاني', 2), e(1, '', 2, 'جعفر الكتاني'), e(2, '', 3, 'إدريس العراقي', 3)];
const OTHER = [e(0, 'أنا', 5, 'محمد بن عبد الكبير', 1), e(5, '', 3, 'إدريس العراقي'), e(3, '', 4, 'المؤلف')];

describe('render', () => {
  test('chain from me: implicit speaker, title before my shaykh, keyword per transmission type', () => {
    assert.equal(T.renderChain(CHAIN),
      'أخبرنا شيخنا محمد عبد الحي الكتاني، عن جعفر الكتاني، أنبأنا إدريس العراقي');
  });

  test('abbreviations and «قال» are style options', () => {
    const s = { style: { abbreviate: true, qala: true, firstTitle: '' } };
    assert.equal(T.renderChain(CHAIN, s), 'أنا محمد عبد الحي الكتاني، عن جعفر الكتاني، قال: أنبا إدريس العراقي');
  });

  test('chain not starting at me names its first narrator', () => {
    assert.equal(T.renderChain([e(7, 'مالك', 8, 'نافع'), e(8, '', 9, 'ابن عمر')]), 'مالك عن نافع، عن ابن عمر');
  });

  test('unknown transmission type falls back to عن', () => {
    assert.equal(T.renderChain([e(0, '', 1, 'فلان', 99)], { style: { firstTitle: '' } }), 'عن فلان');
  });

  test('alternative chains are joined with تحويل and a shared tail «كلاهما عن»', () => {
    const chain = [...CHAIN, e(3, '', 4, 'المؤلف')];
    assert.equal(T.renderChains([chain, OTHER]),
      'أخبرنا شيخنا محمد عبد الحي الكتاني، عن جعفر الكتاني ح وحدثنا شيخنا محمد بن عبد الكبير، كلاهما عن إدريس العراقي، عن المؤلف');
  });

  test('three chains use كلهم; no shared tail means plain تحويل', () => {
    const a = [e(0, '', 1, 'أ'), e(1, '', 9, 'ي')];
    const b = [e(0, '', 2, 'ب'), e(2, '', 9, 'ي')];
    const c = [e(0, '', 3, 'ج'), e(3, '', 9, 'ي')];
    const s = { style: { firstTitle: '' } };
    assert.match(T.renderChains([a, b, c], s), /كلهم عن ي$/);
    assert.equal(T.renderChains([[e(0, '', 1, 'أ')], [e(0, '', 2, 'ب')]], s), 'عن أ ح وعن ب');
  });

  test('renderGroup accepts the /graph paths shape', () => {
    const group = { firstEdge: CHAIN[0], chains: [CHAIN.slice(1)] };
    assert.equal(T.renderGroup(group), T.renderChain(CHAIN));
    assert.equal(T.renderGroup({ firstEdge: CHAIN[0], chains: [] }), 'أخبرنا شيخنا محمد عبد الحي الكتاني');
  });
});

describe('parse', () => {
  const names = r => r.chains.map(c => c.links.map(l => `${l.keyword}:${l.name}`));

  test('parses full and abbreviated keywords, strips titles, honorifics and fillers', () => {
    const r = T.parseIsnad('حدثنا شيخنا العلامة فلان رحمه الله، قال: ثنا علي بن محمد، عن أبيه، أنا مالك رضي الله عنه');
    assert.deepEqual(names(r), [['حدثنا:فلان', 'حدثنا:علي بن محمد', 'عن:أبيه', 'أخبرنا:مالك']]);
    assert.equal(r.chains[0].start, null);
    assert.deepEqual(r.chains[0].links.map(l => l.tx_kind), ['lafz', 'lafz', null, 'qiraa']); // حدثنا = من لفظ الشيخ
  });

  test('tashkeel, و/ف prefixes and multi-word keywords', () => {
    const r = T.parseIsnad('قَرَأْتُ عَلَى زيدٍ، فأخبرنا عمرو، وأجاز لي بكر');
    assert.deepEqual(names(r), [['قرأت على:زيدٍ', 'أخبرنا:عمرو', 'أجازني:بكر']]);
  });

  test('a chain may start with a named narrator', () => {
    const r = T.parseIsnad('مالك عن نافع عن ابن عمر');
    assert.equal(r.chains[0].start, 'مالك');
    assert.deepEqual(names(r), [['عن:نافع', 'عن:ابن عمر']]);
  });

  test('تحويل and «كلاهما» expand into full chains', () => {
    const r = T.parseIsnad('أخبرنا أ، عن ب ح وحدثنا ج، كلاهما عن د، عن هـ');
    assert.deepEqual(names(r), [['أخبرنا:أ', 'عن:ب', 'عن:د', 'عن:هـ'], ['حدثنا:ج', 'عن:د', 'عن:هـ']]);
  });

  test('keyword without a name is dropped with a warning; no keyword at all warns', () => {
    const r = T.parseIsnad('أنا عن فلان');
    assert.deepEqual(names(r), [['عن:فلان']]);
    assert.equal(r.warnings.length, 1);
    assert.match(T.parseIsnad('نص بلا صيغ').warnings[0], /لم يُعثر/);
  });

  test('custom keywords from settings are honoured', () => {
    const settings = { keywords: [{ word: 'روى لنا', abbr: '', variants: [], kind: 'sama', preferred: true }, { word: 'عن', kind: null }] };
    assert.deepEqual(names(T.parseIsnad('روى لنا زيد عن عمرو', settings)), [['روى لنا:زيد', 'عن:عمرو']]);
  });
});

describe('round trip', () => {
  const roundTrip = (chains, settings) => {
    const text = T.renderChains(chains, settings);
    const parsed = T.parseIsnad(text, settings);
    return parsed.chains.map(c => c.links.map(l => l.name));
  };

  for (const style of [{}, { abbreviate: true }, { qala: true, firstTitle: '' }]) {
    test(`render → parse keeps names and order (${JSON.stringify(style)})`, () => {
      const settings = { style };
      assert.deepEqual(roundTrip([CHAIN], settings), [CHAIN.map(x => x.to_name)]);
      assert.deepEqual(roundTrip([[...CHAIN, e(3, '', 4, 'المؤلف')], OTHER], settings),
        [[...CHAIN.map(x => x.to_name), 'المؤلف'], OTHER.map(x => x.to_name)]);
    });
  }

  test('render → parse keeps transmission types (except the joined link, which becomes عن)', () => {
    const parsed = T.parseIsnad(T.renderChain(CHAIN));
    assert.deepEqual(parsed.chains[0].links.map(l => idOf(l.tx_kind)), [2, null, 3]);
  });
});

describe('resolve', () => {
  const persons = [
    { id: 1, name_ar: 'محمد عبد الحي الكتاني', kunya: 'أبو الإسعاد' },
    { id: 2, name_ar: 'جعفر بن إدريس الكتاني' },
    { id: 3, name_ar: 'محمد بن جعفر الكتاني' },
    { id: 4, name_ar: 'إدريس العراقي' },
  ];
  const idx = require('../src/services/isnadText/resolve').buildIndex(persons);
  const r = name => T.resolveName(name, idx);

  test('exact match ignores tashkeel and hamza forms', () => {
    assert.deepEqual([r('إِدْرِيس العراقي').status, r('ادريس العراقي').person_id], ['matched', 4]);
  });
  test('partial names that fit several persons are ambiguous', () => {
    const x = r('الكتاني');
    assert.equal(x.status, 'ambiguous');
    assert.ok(x.candidates.length >= 3);
  });
  test('kunya helps matching; unknown names are new; relatives and sacred names are recognised', () => {
    assert.equal(r('أبو الإسعاد').person_id, 1);
    assert.equal(r('زيد بن ثابت').status, 'new');
    assert.equal(r('أبيه').status, 'relative');
    assert.equal(r('النبي').person_id, -1);
  });
});

describe('settings', () => {
  test('partial settings merge over defaults', () => {
    const s = T.mergeSettings({ style: { abbreviate: true } });
    assert.equal(s.style.abbreviate, true);
    assert.equal(s.style.tahwil, 'ح');
    assert.ok(s.keywords.length > 5);
  });
  test('rejects a form used by two keywords (ambiguous parse)', () => {
    const bad = { keywords: [{ word: 'حدثنا', abbr: 'نا', kind: 'lafz' }, { word: 'أخبرنا', abbr: 'نا', kind: 'qiraa' }] };
    assert.throws(() => T.validateSettings(bad), T.SettingsError);
  });
  test('rejects empty keyword and non-integer type; keeps one preferred form per type', () => {
    assert.throws(() => T.validateSettings({ keywords: [{ word: ' ' }] }), /word: required/);
    assert.throws(() => T.validateSettings({ keywords: [{ word: 'x', kind: 'abc' }] }), /kind: invalid/);
    const s = T.validateSettings({ keywords: [
      { word: 'حدثنا', kind: 'sama', preferred: true }, { word: 'سمعت', kind: 'sama', preferred: true },
    ] });
    assert.deepEqual(s.keywords.map(k => [k.kind, k.preferred]), [['sama', true], ['sama', false]]);
  });
});

describe('ijaza styles: clear sentences, death years, note markers', () => {
  const d = (from, to, name, tx, death, desc) =>
    ({ from_person_id: from, to_person_id: to, to_name: name, tx_kind: K[tx] ?? null, to_death_year: death, to_description: desc });
  const A = [d(0, 1, 'الكتاني', 2, '1382', 'محدث'), d(1, 2, 'جعفر', 1, '1323هـ', 'فقيه'), d(2, 3, 'إدريس', null, '1183', null)];
  const B = [d(0, 5, 'ابن عبد الكبير', 10, null, 'عالم'), d(5, 3, 'إدريس', null, '1183', null)];
  const ALL = { style: { clear: true, deathYears: true, noteMarkers: true } };

  test('clear mode replaces keywords: first person for my link, «وهو …» above it', () => {
    assert.equal(T.renderChain(A, { style: { clear: true, deathYears: true } }),
      'قرأتُ على شيخنا الكتاني (ت 1382هـ)، وهو سمع من جعفر (ت 1323هـ)، عن إدريس (ت 1183هـ)');
  });

  test('a sentence can wrap the name: «قُرئ على فلان وأنا أسمع»', () => {
    assert.equal(T.renderChain(B, { style: { clear: true, firstTitle: '' } }), 'قُرئ على ابن عبد الكبير وأنا أسمع، عن إدريس');
  });

  test('an empty sentence falls back to the keyword form for that type', () => {
    const s = { style: { clear: true, firstTitle: '' }, phrases: { first: { qiraa: '' } } };
    assert.equal(T.renderChain([A[0]], s), 'أخبرنا الكتاني');
  });

  test('note markers only for persons with a biography, once per text', () => {
    const t = T.renderChains([A, B], ALL);
    assert.equal((t.match(/\[\[1\]\]/g) || []).length, 1);
    assert.match(t, /قُرئ على شيخنا ابن عبد الكبير\[\[5\]\] وأنا أسمع/);
    assert.doesNotMatch(t, /\[\[3\]\]/);
    assert.match(t, /كلاهما عن إدريس \(ت 1183هـ\)$/);
  });

  test('styles are off by default (the نص الإسناد panel stays plain)', () => {
    assert.doesNotMatch(T.renderChain(A), /\(ت|قرأتُ على|\[\[/);
  });

  test('parse reads clear sentences back with their types, death years, and drops markers', () => {
    const text = T.renderChains([A, B], ALL) + ' (وهو ثقة)';
    const r = T.parseIsnad(text);
    assert.deepEqual(r.chains.map(c => c.links.map(l => [l.name, l.death_year, idOf(l.tx_kind)])), [
      [['الكتاني', '1382هـ', 2], ['جعفر', '1323هـ', 1], ['إدريس', '1183هـ', null]],
      [['ابن عبد الكبير', null, 10], ['إدريس', '1183هـ', null]],
    ]);
  });

  test('a sentence ending pins the type when the opening is shared («أجازني … إجازةً عامة»)', () => {
    const r = T.parseIsnad('أجازني شيخنا فلان إجازةً عامة، وهو أجازه علان');
    assert.deepEqual(r.chains[0].links.map(l => [l.name, idOf(l.tx_kind)]), [['فلان', 4], ['علان', 3]]);
  });

  test('collectPersons lists persons once in first-mention order, skipping me and sacred nodes', () => {
    const withProphet = [...A, d(3, -1, 'النبي ﷺ', null, null, null)];
    assert.deepEqual(T.collectPersons([withProphet, B]).map(p => p.id), [1, 2, 3, 5]);
  });

  test('sentences are validated (one {الاسم}) and merged per key', () => {
    assert.equal(T.mergeSettings({ phrases: { first: { qiraa: 'قرأتُ بحمد الله على {الاسم}' } } }).phrases.first.sama, 'سمعتُ من {الاسم}');
    assert.throws(() => T.validateSettings({ phrases: { first: { abc: 'x {الاسم}' } } }), /invalid key/);
    assert.throws(() => T.validateSettings({ phrases: { first: { qiraa: 'قرأتُ عليه' } } }), /\{الاسم\} once/);
  });
});

describe('vocabulary: sama\' and other manners are recognised however they are written', () => {
  const one = text => { const l = T.parseIsnad(text).chains[0]?.links[0]; return l && [l.name, idOf(l.tx_kind), l.reading_mode]; };
  const cases = [
    ['سمعت من فلان', ['فلان', 1, null]],
    ['سمعتُ على فلان', ['فلان', 1, null]],
    ['عن فلان سماعاً عليه', ['فلان', 1, null]],
    ['عن فلان سماعاً من لفظه', ['فلان', 'lafz', null]],
    ['وهو سمع على فلان', ['فلان', 1, null]],
    ['وهو سمعه من فلان', ['فلان', 1, null]],
    ['بسماعه من فلان', ['فلان', 1, null]],
    ['حدثنا فلان سماعاً', ['فلان', 1, null]],
    ['عن فلان قرأتُ عليه حفظاً', ['فلان', 2, 'heart']],
    ['قرأتُ على فلان غيباً من حفظي', ['فلان', 2, 'heart']],
    ['عن فلان عرضاً عليه من حفظي', ['فلان', 9, 'heart']],
    ['قرأت على فلان نظراً', ['فلان', 2, 'looking']],
    ['أجازني فلان إجازةً عامة', ['فلان', 4, null]],
  ];
  for (const [text, expected] of cases) test(text, () => assert.deepEqual(one(text), expected));

  test('«على» (keyword) is not confused with the name «علي»', () => {
    assert.deepEqual(one('قرأت على علي بن محمد'), ['علي بن محمد', 2, null]);
  });

  test('reading mode is written in clear mode and read back', () => {
    const e = [{ from_person_id: 0, to_person_id: 1, to_name: 'فلان', tx_kind: 'qiraa', reading_mode: 'heart' },
               { from_person_id: 1, to_person_id: 2, to_name: 'علان', tx_kind: 'qiraa', reading_mode: 'looking' }];
    const text = T.renderChain(e, { style: { clear: true, firstTitle: '' } });
    assert.equal(text, 'قرأتُ على فلان غيباً من حفظي، وهو قرأ على علان نظراً');
    assert.deepEqual(T.parseIsnad(text).chains[0].links.map(l => l.reading_mode), ['heart', 'looking']);
    assert.doesNotMatch(T.renderChain(e), /حفظ/); // keyword mode: unchanged
    // stated once: hidden on my own link only (the ijaza's teachers paragraph already says it)
    assert.equal(T.renderChain(e, { style: { clear: true, firstTitle: '', hideMyReadingMode: true } }),
      'قرأتُ على فلان، وهو قرأ على علان نظراً');
  });
});

test('a stored heart word equal to the old default «حفظاً» follows the new default; custom words stay', () => {
  assert.equal(T.mergeSettings({ style: { heartWord: 'حفظاً' } }).style.heartWord, 'غيباً من حفظي');
  assert.equal(T.mergeSettings({ style: { heartWord: 'عن ظهر قلب' } }).style.heartWord, 'عن ظهر قلب');
});

describe('gender: pronouns, verbs, titles and joiners follow each person', () => {
  const e = (f, fg, to, n, tg, tx) => ({ from_person_id: f, from_gender: fg, to_person_id: to, to_name: n, to_gender: tg, tx_kind: K[tx] ?? null });
  const clear = { style: { clear: true } };

  test('narrator and shaykh agree separately («وهي أجازها»، «وهو أجازته»)', () => {
    const chain = [e(0, null, 1, 'نزهة الكتانية', 'F', 2), e(1, 'F', 2, 'عبد الحي', 'M', 3), e(2, 'M', 3, 'فاطمة', 'F', 3), e(3, 'F', 4, 'زيد', 'M', null)];
    assert.equal(T.renderChain(chain, clear),
      'قرأتُ على شيختنا نزهة الكتانية، وهي أجازها عبد الحي، وهو أجازته فاطمة، عن زيد');
  });

  test('my own sentences agree with the shaykh («أجازتني شيختنا»), and «قُرئ … وهي تسمع»', () => {
    assert.equal(T.renderChain([e(0, null, 1, 'خديجة', 'F', 3)], clear), 'أجازتني شيختنا خديجة');
    assert.equal(T.renderChain([e(0, null, 1, 'أ', 'M', 2), e(1, 'F', 2, 'ب', 'M', 10)], { style: { clear: true, firstTitle: '' } }),
      'قرأتُ على أ، وهي قُرئ على ب وهي تسمع');
  });

  test('keyword mode: «قالت:» for a woman narrator', () => {
    const t = T.renderChain([e(0, null, 1, 'نزهة', 'F', 2), e(1, 'F', 2, 'زيد', 'M', 1)], { style: { qala: true, firstTitle: '', firstTitleF: '' } });
    assert.equal(t, 'أخبرنا نزهة، قالت: حدثنا زيد');
  });

  test('joiners: كلتاهما / كلهن when every narrator meeting is a woman, else كلاهما / كلهم', () => {
    const w = (id, n) => [e(0, null, id, n, 'F', 2), e(id, 'F', 9, 'المؤلف', 'M', 1)];
    const m = (id, n) => [e(0, null, id, n, 'M', 2), e(id, 'M', 9, 'المؤلف', 'M', 1)];
    assert.match(T.renderChains([w(1, 'أ'), w(2, 'ب')], clear), /كلتاهما سمعت من المؤلف$/);
    assert.match(T.renderChains([w(1, 'أ'), m(2, 'ب')], clear), /كلاهما سمع من المؤلف$/);
    assert.match(T.renderChains([w(1, 'أ'), w(2, 'ب'), w(3, 'ج')], clear), /كلهن سمعت من المؤلف$/);
  });

  test('the parser reads feminine sentences, titles and joiners back', () => {
    const r = T.parseIsnad('قرأتُ على شيختنا نزهة الكتانية رحمها الله، وهي قرأت على فلان ح وأجازتني الشيخة خديجة، كلتاهما عن زيد');
    assert.deepEqual(r.chains.map(c => c.links.map(l => [l.name, idOf(l.tx_kind)])), [
      [['نزهة الكتانية', 2], ['فلان', 2], ['زيد', null]],
      [['خديجة', 3], ['زيد', null]],
    ]);
  });

  test('stored copies of the old masculine-only sentences follow the gendered defaults; custom ones stay', () => {
    // saved by an older version: keyed by type id; a custom one is converted through this database's kinds
    const s = T.mergeSettings({ phrases: { others: { 2: 'وهو قرأ على {الاسم}', 3: 'وهو سمع {الاسم} يقول' } } }, { 2: 'qiraa', 3: 'sama' });
    assert.equal(s.phrases.others.qiraa, '{الراوي:وهو قرأ|وهي قرأت} على {الاسم}');
    assert.equal(s.phrases.others.sama, 'وهو سمع {الاسم} يقول');
    assert.equal(s.phrases.others['2'], undefined);
  });

  test('sentences only accept {الاسم} and {الراوي/الشيخ:m|f}', () => {
    assert.doesNotThrow(() => T.validateSettings({ phrases: { others: { qiraa: '{الراوي:وهو|وهي} على {الاسم}' } } }));
    assert.throws(() => T.validateSettings({ phrases: { others: { qiraa: '{الطالب} على {الاسم}' } } }), /use \{الراوي/);
  });
});

describe('تحويل with three or more chains is factored recursively (eg.txt)', () => {
  let ids = {}, next = 1;
  const id = name => (ids[name] ??= next++);
  const chain = names => {
    let prev = 0;
    return names.map((nm, i) => { const e = { from_person_id: prev, to_person_id: id(nm), to_name: nm, tx_kind: i === 0 ? 'qiraa' : null }; prev = e.to_person_id; return e; });
  };
  const mid = ['طاهر', 'السعيد', 'عبد الرحمان'], top = ['ابن غازي', 'ابن بري'];
  const A = chain(['حسين', ...mid, ...top]);
  const B = chain(['خالد', ...mid, ...top]);
  const C = chain(['نزهة', 'عبد الحي', 'ابن الأمين', 'التاودي', 'بناني', 'ابن مجبر', ...top]);
  const D = chain(['نزهة', 'عبد الحي', 'ابن الأمين', 'السقاط', 'بناني', 'ابن مجبر', ...top]);
  const st = { style: { firstTitle: '' } };

  test('two chains meeting early', () => {
    assert.equal(T.renderChains([A, B], st), 'أخبرنا حسين، وخالد، كلاهما عن طاهر، عن السعيد، عن عبد الرحمان، عن ابن غازي، عن ابن بري');
  });

  test('a third chain: the first two stay grouped, all meet at ابن غازي', () => {
    assert.equal(T.renderChains([A, B, C], st),
      'أخبرنا حسين، وخالد، كلاهما عن طاهر، عن السعيد، عن عبد الرحمان'
      + ' ح وأخبرنا نزهة، عن عبد الحي، عن ابن الأمين، عن التاودي، عن بناني، عن ابن مجبر'
      + '، كلاهما عن ابن غازي، عن ابن بري');
  });

  test('four chains: shared beginning written once, nested meeting points, every name once', () => {
    const t = T.renderChains([A, B, C, D], st);
    assert.equal(t,
      'أخبرنا حسين، وخالد، كلاهما عن طاهر، عن السعيد، عن عبد الرحمان'
      // ابن الأمين took from التاودي and السقاط, both from بناني: «عن التاودي، وعن السقاط، كلاهما عن بناني», no ح
      + ' ح وأخبرنا نزهة، عن عبد الحي، عن ابن الأمين، عن التاودي، وعن السقاط، كلاهما عن بناني، عن ابن مجبر'
      + '، كلاهما عن ابن غازي، عن ابن بري');
    for (const name of ['طاهر', 'السعيد', 'عبد الحي', 'بناني', 'ابن غازي']) assert.equal(t.split(name).length - 1, 1, name);
  });

});

describe('meeting point states how they took, عنعنة stays plain «عن»', () => {
  const mk = (id, n, tx2) => [
    { from_person_id: 0, to_person_id: id, to_name: n, tx_kind: 'qiraa' },
    { from_person_id: id, to_person_id: 9, to_name: 'ابن غازي', tx_kind: K[tx2] ?? null },
  ];
  const st = { style: { clear: true, firstTitle: '' } };

  test('same way for every narrator → «كلاهما سمع من / قرأ على»', () => {
    assert.match(T.renderChains([mk(1, 'أ', 1), mk(2, 'ب', 1)], st), /كلاهما سمع من ابن غازي$/);
    assert.match(T.renderChains([mk(1, 'أ', 2), mk(2, 'ب', 2), mk(3, 'ج', 2)], st), /كلهم قرأ على ابن غازي$/);
  });
  test('different ways, or no sentence for that type → «كلاهما عن»', () => {
    assert.match(T.renderChains([mk(1, 'أ', 1), mk(2, 'ب', 2)], st), /كلاهما عن ابن غازي$/);
    assert.match(T.renderChains([mk(1, 'أ', 3), mk(2, 'ب', 3)], st), /كلاهما عن ابن غازي$/);
    assert.match(T.renderChains([mk(1, 'أ', 1), mk(2, 'ب', 1)], {}), /كلاهما عن ابن غازي$/); // keyword mode
  });
  test('the type after «كلاهما سمع من» is read back', () => {
    const r = T.parseIsnad(T.renderChains([mk(1, 'أ', 1), mk(2, 'ب', 1)], st));
    assert.deepEqual(r.chains.map(c => c.links.map(l => idOf(l.tx_kind))), [[2, 1], [2, 1]]);
  });
  test('stored «يروي عن» defaults follow the plain «عن»', () => {
    const s = T.mergeSettings({ phrases: { others: { null: '{الراوي:وهو يروي|وهي تروي} عن {الاسم}' }, first: { null: 'رويتُ عن {الاسم}' } } });
    assert.equal(s.phrases.others.null, 'عن {الاسم}');
    assert.equal(s.phrases.first.null, 'عن {الاسم}');
  });
});

describe('تحويل when one route passes through a shaykh I also read on directly', () => {
  let n = 100;
  const ids = {};
  const id = name => (ids[name] ??= n++);
  const chain = names => {
    let prev = 0;
    return names.map((nm, i) => { const e = { from_person_id: prev, to_person_id: id(nm), to_name: nm, tx_kind: 'qiraa' }; prev = e.to_person_id; return e; });
  };
  const st = { style: { clear: true, firstTitle: '' } };
  const rest = ['ابن الجزري', 'النبي ﷺ'];

  test('me → ابن قدامة and me → ابن آجروم → ابن قدامة: no infinite recursion, no «كلهم» for one person', () => {
    const t = T.renderChains([chain(['ابن قدامة', ...rest]), chain(['ابن آجروم', 'ابن قدامة', ...rest])], st);
    assert.equal(t,
      'قرأتُ على ابن قدامة ح وقرأتُ على ابن آجروم، وهو قرأ على ابن قدامة، وهو قرأ على ابن الجزري، وهو قرأ على النبي ﷺ');
  });

  test('three routes reaching the same shaykh at different depths', () => {
    const t = T.renderChains([
      chain(['ابن قدامة', ...rest]),
      chain(['ابن آجروم', 'ابن قدامة', ...rest]),
      chain(['زيد', 'عمرو', 'ابن قدامة', ...rest]),
    ], st);
    assert.equal((t.match(/ابن الجزري/g) || []).length, 1, t);
    assert.equal((t.match(/ ح /g) || []).length, 2, t);
    // ابن آجروم and عمرو both read on ابن قدامة: «كلاهما» is right; the direct route stands alone
    assert.match(t, /^قرأتُ على ابن قدامة ح /, t);
    assert.match(t, /كلاهما قرأ على ابن قدامة، وهو قرأ على ابن الجزري/, t);
  });

  test('mixed: two different narrators meet at X while another route reaches one of them directly', () => {
    const t = T.renderChains([
      chain(['ب', 'X', ...rest]),
      chain(['أ', 'ب', 'X', ...rest]),
      chain(['ج', 'X', ...rest]),
    ], st);
    assert.match(t, /كلاهما (?:قرأ على|عن) X/, t);
    assert.equal((t.match(/ابن الجزري/g) || []).length, 1, t);
  });
});

describe('تحويل, default «repeat»: every branch names the meeting person', () => {
  let ids = {}, next = 1;
  const id = name => (ids[name] ??= next++);
  const chain = (names, kinds = []) => {
    let prev = 0;
    return names.map((nm, i) => { const e = { from_person_id: prev, from_name: '', to_person_id: id(nm), to_name: nm, tx_kind: kinds[i] ?? (i === 0 ? 'qiraa' : null) }; prev = e.to_person_id; return e; });
  };
  const st = { style: { firstTitle: '' } };
  const clear = { style: { firstTitle: 'شيخنا', clear: true } };

  test('A عن B عن C ح D عن E عن C عن G', () => {
    assert.equal(TT.renderChains([chain(['A', 'B', 'C', 'G']), chain(['D', 'E', 'C', 'G'])], st),
      'أخبرنا A، عن B، عن C ح وأخبرنا D، عن E، عن C، عن G');
  });

  test('nested meeting points: only the nearest one is repeated in each branch', () => {
    const mid = ['طاهر', 'السعيد', 'عبد الرحمان'], top = ['ابن غازي', 'ابن بري'];
    const t = TT.renderChains([
      chain(['حسين', ...mid, ...top]), chain(['خالد', ...mid, ...top]),
      chain(['نزهة', 'عبد الحي', 'ابن الأمين', 'التاودي', 'بناني', 'ابن مجبر', ...top]),
    ], st);
    // حسين and خالد are my teachers, taken the same way: one sentence, no ح
    assert.equal(t, 'أخبرنا حسين، وخالد، كلاهما عن طاهر، عن السعيد، عن عبد الرحمان، عن ابن غازي'
      + ' ح وأخبرنا نزهة، عن عبد الحي، عن ابن الأمين، عن التاودي، عن بناني، عن ابن مجبر، عن ابن غازي، عن ابن بري');
  });

  test('a shaykh already named starts his other route with «أيضاً»', () => {
    // me → A → C → G, me → B → C → G, me → B → X → Y
    // A heard, B read: taken differently, so they stay separate branches
    const chains = [chain(['A', 'C', 'G'], ['sama']), chain(['B', 'C', 'G']), chain(['B', 'X', 'Y'], ['qiraa', 'qiraa'])];
    assert.equal(TT.renderChains(chains, clear),
      'سمعتُ من شيخنا A، عن C ح وقرأتُ على شيخنا B، عن C، عن G ح وقرأ شيخنا B أيضاً على X، عن Y');
    // keyword mode: the classical restart
    assert.match(TT.renderChains(chains, { style: { firstTitle: '' } }), / ح وعن B، أخبرنا X، عن Y$/);
  });

  test('«أيضاً» follows the narrator\'s gender; untyped links «رواه … أيضاً عن»', () => {
    const f = c => c.map((e, i) => (i === 1 ? { ...e, from_gender: 'F' } : i === 0 ? { ...e, to_gender: 'F' } : e));
    const t = TT.renderChains([chain(['A', 'C']), f(chain(['B', 'C'])), f(chain(['B', 'X']))], clear);
    assert.match(t, /ح وروته شيختنا B أيضاً عن X$/, t);
  });

  test('the author gets his title and is reported for colouring', () => {
    const ctx = TT.newContext({ authorId: id('G') });
    const t = TT.renderChains([chain(['A', 'C', 'G'])], st, ctx);
    assert.match(t, /عن المؤلف G$/);
    assert.deepEqual([...ctx.authorNames], ['G', 'المؤلف G']);
    const none = TT.renderChains([chain(['A', 'C', 'G'])], { style: { firstTitle: '', authorTitle: '' } }, TT.newContext({ authorId: id('G') }));
    assert.match(none, /عن G$/);
  });

  test('also-sentences are validated: {الاسم} and {الراوي} once each', () => {
    assert.throws(() => TT.validateSettings({ phrases: { also: { qiraa: 'قرأ أيضاً على {الاسم}' } } }), /الراوي/);
    assert.ok(TT.validateSettings({ phrases: { also: { qiraa: 'وقرأ {الراوي} كذلك على {الاسم}' } } }));
  });
});

describe('my teachers together, and long routes restarting on a new paragraph', () => {
  let ids = {}, next = 500;
  const id = name => (ids[name] ??= next++);
  const chain = (names, kinds = []) => {
    let prev = 0;
    return names.map((nm, i) => { const e = { from_person_id: prev, from_name: '', to_person_id: id(nm), to_name: nm, tx_kind: kinds[i] ?? (i === 0 ? 'qiraa' : null) }; prev = e.to_person_id; return e; });
  };
  const clear = { style: { clear: true } };

  test('read on two teachers the same way, both on one shaykh: «قرأتُ على A، وB، كلاهما قرأ على C»', () => {
    const t = TT.renderChains([chain(['A', 'C', 'G'], ['qiraa', 'qiraa']), chain(['B', 'C', 'G'], ['qiraa', 'qiraa'])], clear);
    assert.equal(t, 'قرأتُ على شيخنا A، وشيخنا B، كلاهما قرأ على C، عن G');
    // the same in «كلاهما» mode
    assert.equal(TT.renderChains([chain(['A', 'C']), chain(['B', 'C'])], { style: { clear: true, tahwilMeet: 'joined' } }),
      'قرأتُ على شيخنا A، وشيخنا B، كلاهما عن C');
  });

  test('a woman teacher keeps her own title; reading mode differs → separate branches', () => {
    const f = chain(['B', 'C']); f[0] = { ...f[0], to_gender: 'F' };
    assert.equal(TT.renderChains([chain(['A', 'C']), f], clear), 'قرأتُ على شيخنا A، وشيختنا B، كلاهما عن C');
    const h = chain(['B', 'C']); h[0] = { ...h[0], reading_mode: 'heart' };
    assert.match(TT.renderChains([chain(['A', 'C']), h], clear), / ح /);
  });

  test('two of three teachers together, the third its own branch', () => {
    const t = TT.renderChains([chain(['A', 'C', 'G']), chain(['B', 'C', 'G']), chain(['D', 'E', 'C', 'G'])], clear);
    assert.equal(t, 'قرأتُ على شيخنا A، وشيخنا B، كلاهما عن C ح وقرأتُ على شيخنا D، عن E، عن C، عن G');
  });

  test('after a long route: «ح» ends the line, the next route starts a paragraph «وأرويه أيضاً»; short routes keep «ح و…»', () => {
    const long = chain(['A', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'Z'], ['sama']);
    const other = chain(['D', 'E', 'Y']);
    const t = TT.renderChains([long, other], { style: { clear: true, longRestartWords: 15 } });
    assert.match(t, /، عن Z ح\n\nوأرويه أيضاً: قرأتُ على شيخنا D، عن E، عن Y$/);
    assert.doesNotMatch(t, / ح و/);
    assert.match(TT.renderChains([chain(['A', 'Z'], ['sama']), other], clear), / ح وقرأتُ على شيخنا D/);
    assert.match(TT.renderChains([long, other], { style: { clear: true, longRestart: '', longRestartWords: 15 } }), / ح وقرأتُ على شيخنا D/);
  });

  test('a long route restarting part-way up: «ح ⏎ ويرويه أيضاً فلان، …» (never «وأرويه»), «وترويه» for a woman', () => {
    const head = ['A', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'H'];
    const t = TT.renderChains([chain([...head, 'X', 'Z']), chain([...head, 'Y', 'W'])], { style: { clear: true, longRestartWords: 5 } });
    assert.match(t, /، عن Z ح\n\nويرويه أيضاً H، عن Y، عن W$/, t);
    const fem = c => c.map(e => (e.to_person_id === id('H') ? { ...e, to_gender: 'F' } : e));
    const tf = TT.renderChains([fem(chain([...head, 'X', 'Z'])), fem(chain([...head, 'Y', 'W']))], { style: { clear: true, longRestartWords: 5 } });
    assert.match(tf, /ح\n\nوترويه أيضاً H، عن Y، عن W$/, tf);
    // short: «ح وعن H» on the same line
    assert.match(TT.renderChains([chain(['A', 'H', 'X']), chain(['A', 'H', 'Y'])], clear), /عن X ح وعن H، عن Y$/);
  });

  test('both forms are read back by the parser', () => {
    const r = TT.parseIsnad('قرأتُ على شيخنا محمد، وشيخنا أحمد (ت 1300هـ)، كلاهما قرأ على زيد، عن عمرو', null);
    assert.deepEqual(r.chains.map(c => c.links.map(l => l.name)), [['محمد', 'زيد', 'عمرو'], ['أحمد', 'زيد', 'عمرو']]);
    assert.equal(r.chains[1].links[0].death_year, '1300هـ');
    assert.equal(r.chains[0].links[1].tx_kind, 'qiraa');
    const p = TT.parseIsnad('قرأتُ على أ، عن ب ح\n\nوأرويه أيضاً: قرأتُ على ج، عن ب', null);
    assert.deepEqual(p.chains.map(c => c.links.map(l => l.name)), [['أ', 'ب'], ['ج', 'ب']]);
    const q = TT.parseIsnad('قرأتُ على أ، عن ب، عن ج ح\n\nويرويه أيضاً ب، عن د', null);
    assert.deepEqual(q.chains.map(c => c.links.map(l => l.name)), [['أ', 'ب', 'ج'], ['ب', 'د']]); // one level, as «ح وعن ب»
    // «، وهو قرأ على» is still a link, not a second name
    assert.deepEqual(TT.parseIsnad('قرأتُ على أ، وهو قرأ على ب', null).chains.map(c => c.links.map(l => l.name)), [['أ', 'ب']]);
  });
});

describe('a shaykh\'s own teachers who meet again: «عن B، وعن C، كلاهما عن D» without ح', () => {
  let ids = {}, next = 900;
  const id = name => (ids[name] ??= next++);
  const chain = (names, kinds = []) => {
    let prev = 0;
    return names.map((nm, i) => { const e = { from_person_id: prev, from_name: '', to_person_id: id(nm), to_name: nm, tx_kind: kinds[i] ?? null }; prev = e.to_person_id; return e; });
  };
  const clear = { style: { clear: true } };
  const Q = ['qiraa', 'qiraa', 'qiraa', 'qiraa'];

  test('same way: «وهو قرأ على B، وعلى C، كلاهما قرأ على D»', () => {
    assert.equal(TT.renderChains([chain(['Z', 'A', 'B', 'D', 'G'], Q), chain(['Z', 'A', 'C', 'D', 'G'], Q)], clear),
      'قرأتُ على شيخنا Z، وهو قرأ على A، وهو قرأ على B، وعلى C، كلاهما قرأ على D، عن G');
  });

  test('keyword mode: «عن B، وعن C، كلاهما عن D»', () => {
    assert.equal(TT.renderChains([chain(['Z', 'A', 'B', 'D']), chain(['Z', 'A', 'C', 'D'])], { style: { firstTitle: '' } }),
      'عن Z، عن A، عن B، وعن C، كلاهما عن D');
  });

  test('different ways: each its own verb; D taken differently: «كلاهما عن D»', () => {
    assert.equal(TT.renderChains([chain(['Z', 'A', 'B', 'D'], Q), chain(['Z', 'A', 'C', 'D'], ['qiraa', 'qiraa', 'sama', 'qiraa'])], clear),
      'قرأتُ على شيخنا Z، وهو قرأ على A، وهو قرأ على B، وسمع من C، كلاهما قرأ على D');
    assert.match(TT.renderChains([chain(['Z', 'A', 'B', 'D'], Q), chain(['Z', 'A', 'C', 'D'], ['qiraa', 'qiraa', 'qiraa', 'sama'])], clear),
      /وهو قرأ على B، وعلى C، كلاهما عن D$/);
  });

  test('a woman narrator: «وهي قرأت على B، وسمعت من C»', () => {
    const f = c => c.map(e => (e.from_person_id === id('A') ? { ...e, from_gender: 'F' } : e));
    assert.match(TT.renderChains([f(chain(['Z', 'A', 'B', 'D'], Q)), f(chain(['Z', 'A', 'C', 'D'], ['qiraa', 'qiraa', 'sama', 'qiraa']))], clear),
      /وهي قرأت على B، وسمعت من C، كلاهما قرأ على D$/);
  });

  test('one of them reaches D through someone else: stays a ح route', () => {
    assert.match(TT.renderChains([chain(['Z', 'A', 'B', 'D'], Q), chain(['Z', 'A', 'C', 'E', 'D'], Q)], clear), / ح /);
  });

  test('read back by the parser: two chains', () => {
    const r = TT.parseIsnad('قرأتُ على شيخنا Z، وهو قرأ على A، وهو قرأ على B، وعلى C، كلاهما قرأ على D', null);
    assert.deepEqual(r.chains.map(c => c.links.map(l => l.name)), [['Z', 'A', 'B', 'D'], ['Z', 'A', 'C', 'D']]);
    const v = TT.parseIsnad('قرأتُ على شيخنا Z، وهو قرأ على A، وهو قرأ على B، وسمع من C، كلاهما قرأ على D', null);
    assert.deepEqual(v.chains.map(c => c.links.map(l => `${l.name}:${l.tx_kind}`)),
      [['Z:qiraa', 'A:qiraa', 'B:qiraa', 'D:qiraa'], ['Z:qiraa', 'A:qiraa', 'C:sama', 'D:qiraa']]);
    const k = TT.parseIsnad('عن Z، عن A، عن B، وعن C، كلاهما عن D', null);
    assert.deepEqual(k.chains.map(c => c.links.map(l => l.name)), [['Z', 'A', 'B', 'D'], ['Z', 'A', 'C', 'D']]);
    // «، وأجاز لي بكر» stays the next link
    assert.deepEqual(TT.parseIsnad('أخبرنا عمرو، وأجاز لي بكر', null).chains.map(c => c.links.map(l => l.name)), [['عمرو', 'بكر']]);
  });
});

describe('Quran «منقطع» jump', () => {
  const q = (from, fromName, to, toName, extra = {}) => ({ ...e(from, fromName, to, toName, 2), ...extra });
  const TAIL = [q(-1, 'النبي ﷺ', -2, 'جبريل عليه السلام'), q(-2, 'جبريل عليه السلام', -3, 'رب العزة')];

  test('the chain stops at the imam with a note: no step to the Prophet ﷺ, no tail', () => {
    const chain = [q(0, 'أنا', 1, 'زيد'), q(1, '', 2, 'قالون'), q(2, '', 3, 'نافع'), q(3, '', -1, 'النبي ﷺ', { munqati: true }), ...TAIL];
    const text = T.renderChain(chain);
    assert.match(text, /نافع\. \[لم يُدخَل بعدُ سند الإمام نافع إلى النبي ﷺ\]$/);
    assert.doesNotMatch(text, /جبريل/);
    assert.equal(T.renderChains([chain]), text);
  });

  test('«الإمام» is not doubled, and a connected chain is unchanged', () => {
    const cut = [q(0, 'أنا', 1, 'زيد'), q(1, '', 3, 'الإمام نافع'), q(3, '', -1, 'النبي ﷺ', { munqati: true })];
    assert.match(T.renderChain(cut), /\[لم يُدخَل بعدُ سند الإمام نافع إلى النبي ﷺ\]$/);
    const whole = [q(0, 'أنا', 1, 'زيد'), q(1, '', 3, 'نافع'), q(3, '', -1, 'النبي ﷺ'), ...TAIL];
    assert.match(T.renderChain(whole), /رب العزة$/);
  });

  test('two routes reaching the imam share one note', () => {
    const a = [q(0, 'أنا', 1, 'زيد'), q(1, '', 3, 'نافع'), q(3, '', -1, 'النبي ﷺ', { munqati: true }), ...TAIL];
    const b = [q(0, 'أنا', 2, 'عمرو'), q(2, '', 3, 'نافع'), q(3, '', -1, 'النبي ﷺ', { munqati: true }), ...TAIL];
    const text = T.renderChains([a, b]);
    assert.equal(text.split('لم يُدخَل').length - 1, 1);
  });
});
