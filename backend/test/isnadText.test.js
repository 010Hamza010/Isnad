const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/services/isnadText');

const e = (from, fromName, to, toName, tx = null) =>
  ({ from_person_id: from, from_name: fromName, to_person_id: to, to_name: toName, transmission_type_id: tx });

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
    assert.deepEqual(r.chains[0].links.map(l => l.tx_type_id), [1, 1, null, 2]);
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
    const settings = { keywords: [{ word: 'روى لنا', abbr: '', variants: [], tx_type_id: 1, preferred: true }, { word: 'عن', tx_type_id: null }] };
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
    assert.deepEqual(parsed.chains[0].links.map(l => l.tx_type_id), [2, null, 3]);
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
    const bad = { keywords: [{ word: 'حدثنا', abbr: 'نا', tx_type_id: 1 }, { word: 'أخبرنا', abbr: 'نا', tx_type_id: 2 }] };
    assert.throws(() => T.validateSettings(bad), T.SettingsError);
  });
  test('rejects empty keyword and non-integer type; keeps one preferred form per type', () => {
    assert.throws(() => T.validateSettings({ keywords: [{ word: ' ' }] }), /word: required/);
    assert.throws(() => T.validateSettings({ keywords: [{ word: 'x', tx_type_id: 'abc' }] }), /tx_type_id/);
    const s = T.validateSettings({ keywords: [
      { word: 'حدثنا', tx_type_id: 1, preferred: true }, { word: 'سمعت', tx_type_id: '1', preferred: true },
    ] });
    assert.deepEqual(s.keywords.map(k => [k.tx_type_id, k.preferred]), [[1, true], [1, false]]);
  });
});

describe('ijaza styles: clear sentences, death years, note markers', () => {
  const d = (from, to, name, tx, death, desc) =>
    ({ from_person_id: from, to_person_id: to, to_name: name, transmission_type_id: tx, to_death_year: death, to_description: desc });
  const A = [d(0, 1, 'الكتاني', 2, '1382', 'محدث'), d(1, 2, 'جعفر', 1, '1323هـ', 'فقيه'), d(2, 3, 'إدريس', null, '1183', null)];
  const B = [d(0, 5, 'ابن عبد الكبير', 10, null, 'عالم'), d(5, 3, 'إدريس', null, '1183', null)];
  const ALL = { style: { clear: true, deathYears: true, noteMarkers: true } };

  test('clear mode replaces keywords: first person for my link, «وهو …» above it', () => {
    assert.equal(T.renderChain(A, { style: { clear: true, deathYears: true } }),
      'قرأتُ على شيخنا الكتاني (ت 1382هـ)، وهو سمع من جعفر (ت 1323هـ)، وهو يروي عن إدريس (ت 1183هـ)');
  });

  test('a sentence can wrap the name: «قُرئ على فلان وأنا أسمع»', () => {
    assert.equal(T.renderChain(B, { style: { clear: true, firstTitle: '' } }), 'قُرئ على ابن عبد الكبير وأنا أسمع، وهو يروي عن إدريس');
  });

  test('an empty sentence falls back to the keyword form for that type', () => {
    const s = { style: { clear: true, firstTitle: '' }, phrases: { first: { 2: '' } } };
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
    assert.deepEqual(r.chains.map(c => c.links.map(l => [l.name, l.death_year, l.tx_type_id])), [
      [['الكتاني', '1382هـ', 2], ['جعفر', '1323هـ', 1], ['إدريس', '1183هـ', null]],
      [['ابن عبد الكبير', null, 10], ['إدريس', '1183هـ', null]],
    ]);
  });

  test('a sentence ending pins the type when the opening is shared («أجازني … إجازةً عامة»)', () => {
    const r = T.parseIsnad('أجازني شيخنا فلان إجازةً عامة، وهو أجازه علان');
    assert.deepEqual(r.chains[0].links.map(l => [l.name, l.tx_type_id]), [['فلان', 4], ['علان', 3]]);
  });

  test('collectPersons lists persons once in first-mention order, skipping me and sacred nodes', () => {
    const withProphet = [...A, d(3, -1, 'النبي ﷺ', null, null, null)];
    assert.deepEqual(T.collectPersons([withProphet, B]).map(p => p.id), [1, 2, 3, 5]);
  });

  test('sentences are validated (one {الاسم}) and merged per key', () => {
    assert.equal(T.mergeSettings({ phrases: { first: { 2: 'قرأتُ بحمد الله على {الاسم}' } } }).phrases.first['1'], 'سمعتُ من {الاسم}');
    assert.throws(() => T.validateSettings({ phrases: { first: { abc: 'x {الاسم}' } } }), /invalid key/);
    assert.throws(() => T.validateSettings({ phrases: { first: { 2: 'قرأتُ عليه' } } }), /\{الاسم\} once/);
  });
});

describe('vocabulary: sama\' and other manners are recognised however they are written', () => {
  const one = text => { const l = T.parseIsnad(text).chains[0]?.links[0]; return l && [l.name, l.tx_type_id, l.reading_mode]; };
  const cases = [
    ['سمعت من فلان', ['فلان', 1, null]],
    ['سمعتُ على فلان', ['فلان', 1, null]],
    ['عن فلان سماعاً عليه', ['فلان', 1, null]],
    ['عن فلان سماعاً من لفظه', ['فلان', 1, null]],
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
    const e = [{ from_person_id: 0, to_person_id: 1, to_name: 'فلان', transmission_type_id: 2, reading_mode: 'heart' },
               { from_person_id: 1, to_person_id: 2, to_name: 'علان', transmission_type_id: 2, reading_mode: 'looking' }];
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
  const e = (f, fg, to, n, tg, tx) => ({ from_person_id: f, from_gender: fg, to_person_id: to, to_name: n, to_gender: tg, transmission_type_id: tx });
  const clear = { style: { clear: true } };

  test('narrator and shaykh agree separately («وهي أجازها»، «وهو أجازته»)', () => {
    const chain = [e(0, null, 1, 'نزهة الكتانية', 'F', 2), e(1, 'F', 2, 'عبد الحي', 'M', 3), e(2, 'M', 3, 'فاطمة', 'F', 3), e(3, 'F', 4, 'زيد', 'M', null)];
    assert.equal(T.renderChain(chain, clear),
      'قرأتُ على شيختنا نزهة الكتانية، وهي أجازها عبد الحي، وهو أجازته فاطمة، وهي تروي عن زيد');
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
    assert.match(T.renderChains([w(1, 'أ'), w(2, 'ب')], clear), /كلتاهما عن المؤلف$/);
    assert.match(T.renderChains([w(1, 'أ'), m(2, 'ب')], clear), /كلاهما عن المؤلف$/);
    assert.match(T.renderChains([w(1, 'أ'), w(2, 'ب'), w(3, 'ج')], clear), /كلهن عن المؤلف$/);
  });

  test('the parser reads feminine sentences, titles and joiners back', () => {
    const r = T.parseIsnad('قرأتُ على شيختنا نزهة الكتانية رحمها الله، وهي قرأت على فلان ح وأجازتني الشيخة خديجة، كلتاهما عن زيد');
    assert.deepEqual(r.chains.map(c => c.links.map(l => [l.name, l.tx_type_id])), [
      [['نزهة الكتانية', 2], ['فلان', 2], ['زيد', null]],
      [['خديجة', 3], ['زيد', null]],
    ]);
  });

  test('stored copies of the old masculine-only sentences follow the gendered defaults; custom ones stay', () => {
    const s = T.mergeSettings({ phrases: { others: { 2: 'وهو قرأ على {الاسم}', 1: 'وهو سمع {الاسم} يقول' } } });
    assert.equal(s.phrases.others['2'], '{الراوي:وهو قرأ|وهي قرأت} على {الاسم}');
    assert.equal(s.phrases.others['1'], 'وهو سمع {الاسم} يقول');
  });

  test('sentences only accept {الاسم} and {الراوي/الشيخ:m|f}', () => {
    assert.doesNotThrow(() => T.validateSettings({ phrases: { others: { 2: '{الراوي:وهو|وهي} على {الاسم}' } } }));
    assert.throws(() => T.validateSettings({ phrases: { others: { 2: '{الطالب} على {الاسم}' } } }), /use \{الراوي/);
  });
});
