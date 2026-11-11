const db = require('../../config/db');
const { kindOf, KEYS } = require('../services/txKinds');
const QR = require('../services/quranReading');

// `SELECT *` so this works before and after migration 006 (the `kind` column)
const withKind = row => ({ ...row, kind: kindOf(row), kind_auto: !(row.kind && KEYS.has(row.kind)) });

exports.findAll = async (applies_to) => {
  let sql = 'SELECT * FROM transmission_types';
  const params = [];
  if (applies_to) { sql += " WHERE applies_to=? OR applies_to='both'"; params.push(applies_to); }
  const [rows] = await db.execute(sql, params);
  return rows.map(withKind);
};

/** { [id]: kind } for this database. */
exports.kindMap = async () => {
  const [rows] = await db.execute('SELECT * FROM transmission_types');
  return Object.fromEntries(rows.map(r => [r.id, kindOf(r)]));
};

/** Annotate rows that carry transmission_type_id with tx_kind. */
exports.annotate = async (rows) => {
  const map = await exports.kindMap();
  rows.forEach(r => { r.tx_kind = r.transmission_type_id == null ? null : map[r.transmission_type_id] ?? null; });
  return rows;
};

/** Quran link rows: always shown as read on the shaykh (see services/quranReading). */
exports.annotateQuran = async (rows) => QR.asReading(rows, await exports.findAll());

/** The type every Quran link is saved with. */
exports.quranReadingId = async () => QR.readingType(await exports.findAll())?.id ?? null;

exports.setKind = async (id, kind) => {
  await db.execute('UPDATE transmission_types SET kind=? WHERE id=?', [kind || null, id]);
};
