/**
 * Routes (full chains me → … → source) the user switched off, per matn / Quran option.
 * Stored as { [scope]: [routeKey, …] }, scope «m:<matnId>» or «q:<riwaya>-<tariq>-<qiraa>»,
 * routeKey = the person ids along the route joined by «.» (starting with 0 = me).
 * A disabled route is left out of the isnad page, the isnad text and new ijazat.
 */
const { HttpError } = require('../utils/httpError');

const SCOPE_RE = /^(?:m|q):[\w-]{1,60}$/;
const KEY_RE = /^-?\d+(?:\.-?\d+){1,80}$/;
const MAX_SCOPES = 500;
const MAX_KEYS = 1000;

const matnScope  = id => `m:${Number(id)}`;
const quranScope = ({ riwaya_id, tariq_id, qiraa_id } = {}) =>
  `q:${Number(riwaya_id) || 0}-${Number(tariq_id) || 0}-${Number(qiraa_id) || 0}`;

/** Key of one route of a /graph paths group. */
const routeKey = (firstEdge, chain) =>
  [firstEdge.from_person_id, firstEdge.to_person_id, ...chain.map(e => e.to_person_id)].map(Number).join('.');

function validate(scope, keys) {
  if (!SCOPE_RE.test(String(scope))) throw new HttpError(400, 'نطاق غير صالح');
  if (!Array.isArray(keys) || !keys.length || keys.length > MAX_KEYS) throw new HttpError(400, 'قائمة الطرق غير صالحة');
  keys.forEach(k => { if (!KEY_RE.test(String(k))) throw new HttpError(400, 'مفتاح طريق غير صالح'); });
  return [...new Set(keys.map(String))];
}

/** Stored map with `keys` switched off (or back on) in one scope; an empty scope is removed. */
function setDisabled(stored, scope, keys, disabled) {
  const all = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
  const cur = new Set(Array.isArray(all[scope]) ? all[scope] : []);
  keys.forEach(k => (disabled ? cur.add(k) : cur.delete(k)));
  delete all[scope];
  if (cur.size) {
    if (cur.size > MAX_KEYS) throw new HttpError(400, 'عدد كبير جداً من الطرق المعطّلة');
    if (Object.keys(all).length >= MAX_SCOPES) throw new HttpError(400, 'عدد كبير جداً من النطاقات');
    all[scope] = [...cur];
  }
  return all;
}

/**
 * Split formatted groups into the enabled ones (each with `keys`, one per chain) and the list of
 * disabled routes ({ key, names }). A group whose routes are all disabled is dropped.
 */
function applyDisabled(groups, disabledKeys = []) {
  const off = new Set(disabledKeys);
  const disabled = [];
  const paths = [];
  groups.forEach(g => {
    const chains = [], keys = [];
    g.chains.forEach(c => {
      const key = routeKey(g.firstEdge, c);
      if (off.has(key)) disabled.push({ key, names: [g.firstEdge.to_name, ...c.map(e => e.to_name)] });
      else { chains.push(c); keys.push(key); }
    });
    if (chains.length) paths.push({ ...g, chains, keys });
  });
  return { paths, disabled };
}

module.exports = { matnScope, quranScope, routeKey, validate, setDisabled, applyDisabled, SCOPE_RE };
