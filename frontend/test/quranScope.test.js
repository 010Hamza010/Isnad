import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeItem, itemLabel, scopeOptions, addItem, linkMatchesScope, findDuplicate, linkItems, scopeText } from '../src/utils/quranScope.js';

const lists = {
  qiraat: [{ id: 1, name_ar: 'قراءة نافع' }, { id: 5, name_ar: 'قراءة عاصم' }],
  riwayat: [{ id: 3, qiraa_id: 1, name_ar: 'رواية ورش' }, { id: 4, qiraa_id: 1, name_ar: 'رواية قالون' }, { id: 9, qiraa_id: 5, name_ar: 'رواية حفص' }],
  turuq: [{ id: 7, riwaya_id: 3, parent_id: null, name_ar: 'طريق الأزرق' }, { id: 8, riwaya_id: 3, parent_id: 7, name_ar: 'طريق فرعي' }],
};

test('a riwaya brings its qiraa, a tariq its riwaya and qiraa', () => {
  assert.deepEqual(completeItem({ riwaya_id: '3' }, lists), { qiraa_id: 1, riwaya_id: 3, tariq_id: null });
  assert.deepEqual(completeItem({ tariq_id: 7 }, lists), { qiraa_id: 1, riwaya_id: 3, tariq_id: 7 });
  assert.deepEqual(completeItem({ qiraa_id: '', riwaya_id: '', tariq_id: '' }, lists), { qiraa_id: null, riwaya_id: null, tariq_id: null });
});

test('labels show the whole path, nested turuq included', () => {
  assert.equal(itemLabel({ riwaya_id: 3 }, lists), 'قراءة نافع › رواية ورش');
  assert.equal(itemLabel({ tariq_id: 8 }, lists), 'قراءة نافع › رواية ورش › طريق الأزرق › طريق فرعي');
  assert.equal(itemLabel({ tariq_id: 7 }, lists, { short: true }), 'نافع › ورش › الأزرق');
});

test('options: each qiraa, then its riwayat, then their turuq; «كل…» only where there is more below', () => {
  const o = scopeOptions(lists);
  assert.deepEqual(o.map(x => [x.label, x.sub]), [
    ['قراءة نافع', 'كل الروايات'],
    ['قراءة نافع › رواية ورش', 'كل الطرق'],
    ['قراءة نافع › رواية ورش › طريق الأزرق', undefined],
    ['قراءة نافع › رواية ورش › طريق الأزرق › طريق فرعي', undefined],
    ['قراءة نافع › رواية قالون', undefined],
    ['قراءة عاصم', 'كل الروايات'],
    ['قراءة عاصم › رواية حفص', undefined],
  ]);
  assert.equal(new Set(o.map(x => x.value)).size, o.length);
});

test('adding: once; a broader pick replaces what it covers; a narrower one under a broader is ignored', () => {
  let items = addItem([], { tariq_id: 7 }, lists);
  items = addItem(items, { tariq_id: 7 }, lists);
  assert.equal(items.length, 1);
  items = addItem(items, { riwaya_id: 9 }, lists);
  items = addItem(items, { riwaya_id: 3 }, lists);                     // covers the tariq of ورش
  assert.deepEqual(items, [{ qiraa_id: 5, riwaya_id: 9, tariq_id: null }, { qiraa_id: 1, riwaya_id: 3, tariq_id: null }]);
  assert.deepEqual(addItem(items, { tariq_id: 8 }, lists), items);    // already covered by ورش
});

test('filter: by qiraa or riwaya; a link without items or for a whole qiraa matches', () => {
  const warsh = { items: [{ qiraa_id: null, riwaya_id: 3, tariq_id: null }] };
  const nafi = { items: [{ qiraa_id: 1, riwaya_id: null, tariq_id: null }] };
  const all = { is_general: 1, items: [] };
  const none = { is_general: 0, items: [] };
  assert.equal(linkMatchesScope(warsh, 'q1', lists), true);   // the qiraa is filled from the riwaya
  assert.equal(linkMatchesScope(warsh, 'q5', lists), false);
  assert.equal(linkMatchesScope(warsh, 'r4', lists), false);
  assert.equal(linkMatchesScope(nafi, 'r4', lists), true);
  assert.equal(linkMatchesScope(nafi, 'r9', lists), false);
  assert.equal(linkMatchesScope(all, 'r9', lists), true);
  assert.equal(linkMatchesScope(none, 'r9', lists), false);
  assert.equal(linkMatchesScope(warsh, '', lists), true);
});

test('duplicate: same reader and shaykh, not the link being edited', () => {
  const links = [{ id: 1, from_person_id: 0, to_person_id: 12 }, { id: 2, from_person_id: 12, to_person_id: 30 }];
  assert.equal(findDuplicate(links, { from_person_id: 0, to_person_id: '12' }).id, 1);
  assert.equal(findDuplicate(links, { id: 1, from_person_id: 0, to_person_id: 12 }), null);
  assert.equal(findDuplicate(links, { from_person_id: 12, to_person_id: 12 }), null);
  assert.equal(findDuplicate(links, { from_person_id: 0, to_person_id: '' }), null);
});

const withGroups = { ...lists, groups: [
  { id: 3, name_ar: 'العشر الصغرى', text_ar: 'القراءات العشر الصغرى', items: [{ qiraa_id: 1 }, { qiraa_id: 5 }] },
  { id: 4, name_ar: 'قالون وورش', text_ar: null, items: [{ riwaya_id: 3 }, { riwaya_id: 4 }] },
] };

test('groups come first among the options; a group\'s members are offered without turuq', () => {
  const o = scopeOptions(withGroups);
  assert.deepEqual(o.slice(0, 2).map(x => [x.value, x.label, x.sub]), [['g3', '◆ العشر الصغرى', 'مجموعة — 2'], ['g4', '◆ قالون وورش', 'مجموعة — 2']]);
  assert.equal(scopeOptions(lists, { withTuruq: false }).some(x => x.item?.tariq_id), false);
});

test('a link read with a group: its members count for the filter, its text names the group', () => {
  const link = { items: [{ qiraa_id: 5 }], groups: [{ group_id: 4, name_ar: 'قالون وورش' }] };
  assert.deepEqual(linkItems(link, withGroups), [{ qiraa_id: 5 }, { riwaya_id: 3 }, { riwaya_id: 4 }]);
  assert.equal(linkMatchesScope(link, 'r4', withGroups), true);
  assert.equal(linkMatchesScope({ items: [], groups: [3] }, 'q5', withGroups), true);
  assert.equal(linkMatchesScope({ items: [], groups: [3] }, 'r9', withGroups), true);    // عاصم as a whole carries حفص
  assert.equal(linkMatchesScope({ items: [], groups: [4] }, 'q5', withGroups), false);
  assert.equal(scopeText({ groups: [{ group_id: 3 }], items: [{ riwaya_id: 9 }] }, withGroups), 'القراءات العشر الصغرى وقراءة عاصم › رواية حفص');
  assert.equal(scopeText(link, withGroups), 'قالون وورش وقراءة عاصم');
});
