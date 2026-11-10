/**
 * Full backup as one JSON file (download / restore from the settings page).
 *   { format: 'isnad-backup', version: 1, created_at, migrations: [...], tables: { name: [row, …] } }
 * The account (users: username and password) is never in the file — a restore keeps the current
 * one and gives every user_id column to it. Dates and JSON stay strings as MySQL wrote them,
 * binary columns (archived PDFs) are { $b64 }.
 */
const { HttpError } = require('../utils/httpError');

const FORMAT = 'isnad-backup';
const VERSION = 1;
const SKIP = new Set(['users', 'schema_migrations']);

const encodeValue = v => (Buffer.isBuffer(v) ? { $b64: v.toString('base64') } : v);
const decodeValue = v => (v && typeof v === 'object' && typeof v.$b64 === 'string' ? Buffer.from(v.$b64, 'base64') : v);
const encodeRow = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, encodeValue(v)]));

function build(tables, migrations, now = new Date()) {
  const out = {};
  Object.keys(tables).filter(t => !SKIP.has(t)).sort().forEach(t => { out[t] = tables[t].map(encodeRow); });
  return { format: FORMAT, version: VERSION, created_at: now.toISOString(), migrations: [...migrations].sort(), tables: out };
}

/** Row counts per table (for the preview and the summary). */
const counts = tables => Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length]));

/**
 * Check a file against the current database and plan the restore.
 * `columns` = { table: [column, …] } of the current database; `applied` = its migrations.
 * Returns [{ table, columns, rows }] for every current table (absent ones are emptied).
 */
function plan(file, { columns, applied, userId }) {
  if (!file || file.format !== FORMAT || !file.tables || typeof file.tables !== 'object')
    throw new HttpError(400, 'هذا الملف ليس نسخة احتياطية من «إسناد»');
  if (Number(file.version) > VERSION) throw new HttpError(400, 'النسخة من إصدار أحدث — حدّث البرنامج أولاً');
  const newer = (file.migrations || []).filter(m => !applied.includes(m));
  if (newer.length) throw new HttpError(400, `النسخة من إصدار أحدث (${newer.join('، ')}) — حدّث البرنامج أولاً`);
  const unknown = Object.keys(file.tables).filter(t => !columns[t] || SKIP.has(t));
  if (unknown.length) throw new HttpError(400, `جداول غير معروفة في النسخة: ${unknown.join('، ')}`);

  return Object.keys(columns).filter(t => !SKIP.has(t)).map(table => {
    const rows = file.tables[table] || [];
    if (!Array.isArray(rows)) throw new HttpError(400, `بيانات «${table}» غير صالحة`);
    const cur = new Set(columns[table]);
    const cols = [...new Set(rows.flatMap(r => Object.keys(r || {})))].filter(c => cur.has(c));
    return {
      table,
      columns: cols,
      rows: rows.map(r => cols.map(c => (c === 'user_id' && userId != null ? userId : decodeValue(r[c] ?? null)))),
    };
  });
}

module.exports = { build, plan, counts, encodeValue, decodeValue, FORMAT, VERSION, SKIP };
