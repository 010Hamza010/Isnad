const { test } = require('node:test');
const assert = require('node:assert/strict');
const QR = require('../src/services/quranReading');
const { planImport } = require('../src/services/isnadImport');

// numbered like a real DB: the reading type is not id 1, and a mutoon-only reading type comes first
const TYPES = [
  { id: 1, name_ar: 'سماع', kind: null, applies_to: 'both' },
  { id: 2, name_ar: 'قراءة متن', kind: 'qiraa', applies_to: 'mutoon' },
  { id: 5, name_ar: 'قراءة على الشيخ', kind: null, applies_to: 'both' },
  { id: 6, name_ar: 'قراءة', kind: 'qiraa', applies_to: 'quran' },
  { id: 9, name_ar: 'عرض', kind: 'ard', applies_to: 'quran' },
];

test('the reading type is the lowest reading type valid for the Quran', () => {
  assert.equal(QR.readingType(TYPES).id, 5);
  assert.equal(QR.readingType(TYPES.filter(t => t.id !== 5)).id, 6);
  assert.equal(QR.readingType([{ id: 1, name_ar: 'سماع', applies_to: 'both' }]), null);
});

test('Quran links are shown as read on the shaykh, whatever type they carried', () => {
  const rows = QR.asReading([{ transmission_type_id: 1, tx_name: 'سماع' }, { transmission_type_id: null }], TYPES);
  assert.deepEqual(rows.map(r => [r.transmission_type_id, r.tx_name, r.tx_kind]), [[5, 'قراءة على الشيخ', 'qiraa'], [5, 'قراءة على الشيخ', 'qiraa']]);
  // a database without a reading type still says «قراءة على الشيخ»
  assert.deepEqual(QR.asReading([{ transmission_type_id: 1 }], [])[0], { transmission_type_id: null, tx_name: 'قراءة على الشيخ', tx_kind: 'qiraa' });
});

test('fast entry into the Quran saves every link as read; into a matn it keeps the parsed type', () => {
  const chains = [{ start: null, links: [{ person_id: 3, tx_kind: 'sama' }, { person_id: 4, tx_kind: 'ijaza' }] }];
  const quran = planImport(chains, { types: TYPES, target: 'quran' });
  assert.deepEqual(quran.edges.map(e => [e.tx_kind, e.transmission_type_id]), [['qiraa', 5], ['qiraa', 5]]);
  const matn = planImport(chains, { types: TYPES, target: 'matn' });
  assert.deepEqual(matn.edges.map(e => e.transmission_type_id), [1, null]);
});
