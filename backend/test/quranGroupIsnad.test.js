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

  test('meetingPoints: where no carrying link goes further up', () => {
    const mine = [link(0, 1), link(0, 5)];
    const upper = [link(1, 2), link(2, 3), link(5, 3)];
    assert.deepEqual(G.meetingPoints(mine, upper), [3]);
    assert.deepEqual(G.meetingPoints([link(0, 1)], []).sort(), [1]);
  });

  test('chooseRiwaya: the wanted one if in the group, else حفص, else the first', () => {
    assert.equal(G.chooseRiwaya(RIWAYAT, 11), 11);
    assert.equal(G.chooseRiwaya(RIWAYAT, 99), 22);
    assert.equal(G.chooseRiwaya(RIWAYAT, null), 22);
    assert.equal(G.chooseRiwaya(RIWAYAT.slice(0, 2), null), 11);
    assert.equal(G.chooseRiwaya([], 11), null);
  });

  test('withStop: each chain ends with the stop step, also a route of one link', () => {
    const fe = { from_person_id: 0, to_person_id: 1, to_name: 'زيد' };
    const out = G.withStop([{ firstEdge: fe, chains: [[]] }, { firstEdge: fe, chains: [] }], 'بأسانيده');
    out.forEach(g => assert.equal(g.chains[0][0].group_stop, true));
    assert.equal(out[0].chains[0][0].from_person_id, 1);
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
  test('defaults to stop, حفص, a stop text', () => {
    const s = IS.mergeSettings(null);
    assert.equal(s.quran_group.mode, 'stop');
    assert.equal(s.quran_group.riwaya_id, null);
    assert.ok(s.quran_group.stop_text.includes('بأسانيده'));
  });
  test('keeps valid stored values and drops invalid ones', () => {
    const s = IS.mergeSettings({ quran_group: { mode: 'riwaya', riwaya_id: '11', stop_text: ' نص ' } });
    assert.deepEqual(s.quran_group, { mode: 'riwaya', riwaya_id: 11, stop_text: 'نص' });
    const bad = IS.mergeSettings({ quran_group: { mode: 'x', riwaya_id: 'abc', stop_text: '' } });
    assert.equal(bad.quran_group.mode, 'stop');
    assert.equal(bad.quran_group.riwaya_id, null);
    assert.ok(bad.quran_group.stop_text.length > 0);
  });
  test('validateSettings returns it and rejects a long stop text', () => {
    assert.equal(IS.validateSettings({ quran_group: { mode: 'all' } }).quran_group.mode, 'all');
    assert.throws(() => IS.validateSettings({ quran_group: { stop_text: 'ا'.repeat(301) } }), /طويل/);
  });
});
