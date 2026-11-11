// For now every Quran link is by reading («قراءة على الشيخ»): saved so and shown so, whatever type
// it carried before (the stored type is left as it was). The one place to change when other ways
// of receiving the Quran come back.
const { kindOf } = require('./txKinds');

const QURAN_KIND = 'qiraa';
const FALLBACK_NAME = 'قراءة على الشيخ';

/** Id of the reading type valid for the Quran (lowest id), null when the database has none. */
function readingType(types) {
  return types
    .filter(t => kindOf(t) === QURAN_KIND && (!t.applies_to || t.applies_to === 'both' || t.applies_to === 'quran'))
    .sort((a, b) => a.id - b.id)[0] || null;
}

/** Quran link rows shown as read on the shaykh. */
function asReading(rows, types) {
  const t = readingType(types);
  rows.forEach(r => {
    r.transmission_type_id = t ? t.id : null;
    r.tx_name = t ? t.name_ar : FALLBACK_NAME;
    r.tx_kind = QURAN_KIND;
  });
  return rows;
}

module.exports = { QURAN_KIND, readingType, asReading };
