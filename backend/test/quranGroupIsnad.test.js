const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/services/quranGroupIsnad');
const T = require('../src/services/isnadText');
const IS = require('../src/services/ijaza/settings');

// qiraat 1 نافع (riwayat 11 قالون، 12 ورش), 2 عاصم (21 شعبة، 22 حفص)
const RIWAYAT = [
  { id: 11, qiraa_id: 1, name_ar: 'رواية قالون' }, { id: 12, qiraa_id: 1, name_ar: 'رواية ورش' },
  { id: 21, qiraa_id: 2, name_ar: 'رواية شعبة' }, { id: 22, qiraa_id: 2, name_ar: 'رواية حفص' },
];
const RQ = new Map(RIWAYAT.map(r => [r.id, r.qiraa_id]));
const GROUP = { id: 7, items: [{ qiraa_id: 1, riwaya_id: null }, { qiraa_id: 2, riwaya_id: null }] };
const link = (from, to, extra = {}) => ({ from_person_id: from, to_person_id: to, items: [], groups: [], is_general: 0, ...extra });

describe('quranGroupIsnad', () => {
  test('groupRiwayat: qiraa members bring all their riwayat, riwaya members themselves, once', () => {
    assert.deepEqual(G.groupRiwayat(GROUP, RIWAYAT).map(r => r.id), [11, 12, 21, 22]);
    assert.deepEqual(G.groupRiwayat({ items: [{ riwaya_id: 22 }, { qiraa_id: 2 }] }, RIWAYAT).map(r => r.id), [22, 21]);
  });

  test('carriesGroup: «عام», the group itself, or every member named in full', () => {
    assert.ok(G.carriesGroup(link(1, 2, { is_general: 1 }), GROUP, RIWAYAT, RQ));
    assert.ok(G.carriesGroup(link(1, 2, { groups: [{ group_id: 7 }] }), GROUP, RIWAYAT, RQ));
    assert.ok(G.carriesGroup(link(1, 2, { items: [{ qiraa_id: 1 }, { qiraa_id: 2 }] }), GROUP, RIWAYAT, RQ));
    // عاصم through both of its riwayat counts as the whole qiraa
    assert.ok(G.carriesGroup(link(1, 2, { items: [{ qiraa_id: 1 }, { riwaya_id: 21 }, { riwaya_id: 22 }] }), GROUP, RIWAYAT, RQ));
    // only حفص: not the whole of عاصم
    assert.ok(!G.carriesGroup(link(1, 2, { items: [{ qiraa_id: 1 }, { riwaya_id: 22 }] }), GROUP, RIWAYAT, RQ));
    assert.ok(!G.carriesGroup(link(1, 2, { items: [{ qiraa_id: 1 }] }), GROUP, RIWAYAT, RQ));
  });

  test('chooseRiwaya: the wanted one if in the group, else حفص, else the first', () => {
    assert.equal(G.chooseRiwaya(RIWAYAT, 11), 11);
    assert.equal(G.chooseRiwaya(RIWAYAT, 99), 22);
    assert.equal(G.chooseRiwaya(RIWAYAT, null), 22);
    assert.equal(G.chooseRiwaya(RIWAYAT.slice(0, 2), null), 11);
    assert.equal(G.chooseRiwaya([], 11), null);
  });

  test('stopsFor: those named for the group, else those for every group', () => {
    const stops = [{ match: 'الجزري', text: 'النشر', groups: '' }, { match: 'الداني', text: 'التعريف', groups: 'العشر النافعية، أخرى' }];
    assert.deepEqual(G.stopsFor(stops, 'العشر الصغرى').map(x => x.match), ['الجزري']);
    assert.deepEqual(G.stopsFor(stops, 'العشر النافعيه').map(x => x.match), ['الداني']);   // normalised
    assert.deepEqual(G.stopsFor(stops, null).map(x => x.match), ['الجزري']);
  });

  test('cutAtStops: cut after the first stop point, the same cut chains once, others whole', () => {
    const fe = { from_person_id: 0, to_person_id: 1, to_name: 'زيد' };
    const step = (f, t) => ({ from_person_id: f, to_person_id: t, to_name: `#${t}` });
    const paths = [
      { firstEdge: fe, chains: [[step(1, 2), step(2, 50), step(50, 60)]] },          // نافع's isnad through الجزري (2)
      { firstEdge: fe, chains: [[step(1, 2), step(2, 51), step(51, 61)]] },          // عاصم's, same up to الجزري
      { firstEdge: { ...fe, to_person_id: 3 }, chains: [[step(3, 70)]] },            // no stop point: whole
    ];
    const out = G.cutAtStops(paths, id => (id === 2 ? 'وإسناده موجود في كتابه النشر' : null));
    const people = out.flatMap(g => g.chains.map(c => [g.firstEdge, ...c].map(x => x.to_person_id)));
    assert.deepEqual(people, [[1, 2, G.STOP_MARK], [3, 70]]);
    assert.equal(out[0].chains[0].at(-1).note, 'وإسناده موجود في كتابه النشر');
    // my shaykh is the stop point
    assert.deepEqual(G.cutAtStops([{ firstEdge: fe, chains: [[step(1, 9)]] }], id => (id === 1 ? 'x' : null))[0].chains, [[{ from_person_id: 1, from_name: 'زيد', to_person_id: G.STOP_MARK, to_name: '', group_stop: true, note: 'x', items: [] }]]);
  });
});

describe('group isnad text', () => {
  const e = (from, fromName, to, toName) => ({ from_person_id: from, from_name: fromName, to_person_id: to, to_name: toName, tx_kind: 'qiraa' });
  const stop = from => ({ from_person_id: from, to_person_id: G.STOP_MARK, to_name: '', group_stop: true, note: 'بأسانيده إلى الأئمة' });

  test('the chain stops at the meeting point with the stop text', () => {
    const text = T.renderChains([[e(0, 'أنا', 1, 'زيد'), e(1, '', 2, 'ابن الجزري'), stop(2)]]);
    assert.match(text, /ابن الجزري، بأسانيده إلى الأئمة$/);
  });

  test('two shaykhs meeting at ابن الجزري: the stop text once', () => {
    const text = T.renderChains([
      [e(0, 'أنا', 1, 'زيد'), e(1, '', 3, 'ابن الجزري'), stop(3)],
      [e(0, 'أنا', 2, 'عمرو'), e(2, '', 3, 'ابن الجزري'), stop(3)],
    ]);
    assert.equal(text.split('بأسانيده').length - 1, 1);
    assert.match(text, /بأسانيده إلى الأئمة$/);
  });

  test('my shaykh is the meeting point', () => {
    assert.match(T.renderChains([[e(0, 'أنا', 1, 'زيد'), stop(1)]]), /زيد، بأسانيده إلى الأئمة$/);
  });
});

describe('ijaza settings: quran_group', () => {
  test('defaults: stop at ابن الجزري («النشر»), الداني for «العشر النافعية» («التعريف»), حفص', () => {
    const s = IS.mergeSettings(null);
    assert.equal(s.quran_group.mode, 'stop');
    assert.equal(s.quran_group.riwaya_id, null);
    assert.deepEqual(s.quran_group.stops.map(x => [x.match, x.groups]), [['الجزري', ''], ['الداني', 'العشر النافعية']]);
    assert.match(s.quran_group.stops[0].text, /النشر/);
    assert.match(s.quran_group.stops[1].text, /التعريف/);
  });
  test('keeps valid stored values and drops invalid ones', () => {
    const s = IS.mergeSettings({ quran_group: { mode: 'riwaya', riwaya_id: '11', stops: [{ match: ' الشاطبي ', text: 'نص' }, { match: '' }, null] } });
    assert.deepEqual(s.quran_group, { mode: 'riwaya', riwaya_id: 11, stops: [{ match: 'الشاطبي', text: 'نص', groups: '' }] });
    const bad = IS.mergeSettings({ quran_group: { mode: 'x', riwaya_id: 'abc', stops: 'x' } });
    assert.equal(bad.quran_group.mode, 'stop');
    assert.equal(bad.quran_group.riwaya_id, null);
    assert.equal(bad.quran_group.stops.length, 2);
  });
  test('validateSettings returns it and rejects a long stop text', () => {
    assert.equal(IS.validateSettings({ quran_group: { mode: 'all' } }).quran_group.mode, 'all');
    assert.throws(() => IS.validateSettings({ quran_group: { stops: [{ match: 'x', text: 'ا'.repeat(301) }] } }), /طويل/);
  });
});
