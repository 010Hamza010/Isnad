import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betweenChoice, betweenQuery, quranChoices } from '../src/utils/between.js';

const P = s => new URLSearchParams(s);

test('defaults: from me, to a matn', () => {
  assert.deepEqual(betweenChoice(P('')), { from: '0', kind: 'matn', to: '', module: 'mutoon', matn: '', q: '' });
  assert.equal(betweenChoice(P('kind=bad')).kind, 'matn');
});

test('the API query for each kind, null while incomplete', () => {
  assert.equal(betweenQuery(betweenChoice(P('from=12&kind=matn&matn=52'))), 'from=12&matn_id=52');
  assert.equal(betweenQuery(betweenChoice(P('kind=person&to=9'))), 'from=0&to=9');
  assert.equal(betweenQuery(betweenChoice(P('from=3&kind=person&to=9&module=quran'))), 'from=3&to=9&module=quran');
  assert.equal(betweenQuery(betweenChoice(P('kind=quran&q=r9'))), 'from=0&riwaya_id=9');
  assert.equal(betweenQuery(betweenChoice(P('kind=quran&q=q5'))), 'from=0&qiraa_id=5');
  assert.equal(betweenQuery(betweenChoice(P('kind=matn'))), null);
  assert.equal(betweenQuery(betweenChoice(P('kind=person&from=9&to=9'))), null);
  assert.equal(betweenQuery(betweenChoice(P('kind=quran&q=x1'))), null);
});

test('Quran choices: riwayat, then whole qiraat', () => {
  assert.deepEqual(quranChoices([{ id: 9, name_ar: 'حفص عن عاصم', qiraa_name: 'قراءة عاصم' }], [{ id: 5, name_ar: 'قراءة عاصم' }]), [
    { value: 'r9', label: 'حفص عن عاصم', sub: 'قراءة عاصم' }, { value: 'q5', label: 'قراءة عاصم', sub: 'القراءة كلها' },
  ]);
});
