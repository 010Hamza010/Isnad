/**
 * Merging a duplicate person («drop») into the one to keep: every link, author, imam, rawi and
 * teacher order moves to «keep», the empty fields of «keep» are filled from «drop», and «drop» goes.
 * Pure planning here; models/PersonModel.merge applies it in one transaction.
 */
const { HttpError } = require('../utils/httpError');

const FILL = ['name_latin', 'kunya', 'nisba', 'century', 'death_year', 'region', 'description'];
const empty = v => v == null || String(v).trim() === '';

function checkPair(dropId, keepId) {
  const d = Number(dropId), k = Number(keepId);
  if (!Number.isInteger(d) || !Number.isInteger(k) || d <= 0 || k <= 0) throw new HttpError(400, 'اختر علَمين صحيحين');
  if (d === k) throw new HttpError(400, 'لا يُدمج العلَم في نفسه');
  return [d, k];
}

/** Fields of «keep» that are empty and filled in «drop». */
function fillFields(keep, drop) {
  return Object.fromEntries(FILL.filter(f => empty(keep[f]) && !empty(drop[f])).map(f => [f, drop[f]]));
}

/**
 * Matn links touching either person → what to change. A link that becomes keep → keep is removed,
 * and so is one that would repeat a link already there (same student, shaykh and matn).
 * links: [{ id, from_person_id, to_person_id, matn_id }] (all links of keep and drop)
 */
function planMatnLinks(links, dropId, keepId) {
  const swap = id => (Number(id) === dropId ? keepId : Number(id));
  const sig = l => `${l.from}:${l.to}:${l.matn_id ?? ''}`;
  const moved = links.map(l => ({ id: l.id, from: swap(l.from_person_id), to: swap(l.to_person_id), matn_id: l.matn_id,
    touched: Number(l.from_person_id) === dropId || Number(l.to_person_id) === dropId }));
  const seen = new Set(moved.filter(l => !l.touched).map(sig));
  const update = [], remove = [];
  moved.filter(l => l.touched).forEach(l => {
    if (l.from === l.to || seen.has(sig(l))) { remove.push(l.id); return; }
    seen.add(sig(l));
    update.push({ id: l.id, from: l.from, to: l.to });
  });
  return { update, remove };
}

/** Teacher orders ({ key: [ids] }) with «drop» replaced by «keep», each list without repeats. */
function mergeOrders(orders, dropId, keepId) {
  if (!orders || typeof orders !== 'object' || Array.isArray(orders)) return { orders, changed: false };
  let changed = false;
  const out = Object.fromEntries(Object.entries(orders).map(([k, ids]) => {
    if (!Array.isArray(ids) || !ids.some(i => Number(i) === dropId)) return [k, ids];
    changed = true;
    return [k, [...new Set(ids.map(i => (Number(i) === dropId ? keepId : Number(i))))]];
  }));
  return { orders: out, changed };
}

module.exports = { checkPair, fillFields, planMatnLinks, mergeOrders, FILL };
