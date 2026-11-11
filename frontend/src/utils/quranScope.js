// What was read in a Quran link: items { qiraa_id, riwaya_id, tariq_id } (any may be empty).
// Helpers for the connections page: one searchable list of every qiraa / riwaya / tariq,
// filling the levels above what was picked, labels, filters and duplicate detection.

const id = v => (v === '' || v == null ? null : Number(v));
const byId = rows => new Map(rows.map(r => [Number(r.id), r]));

/** The levels above what was picked: a tariq brings its riwaya, a riwaya its qiraa. */
export function completeItem(item, { riwayat, turuq }) {
  const R = byId(riwayat), T = byId(turuq);
  let { qiraa_id, riwaya_id, tariq_id } = { qiraa_id: id(item.qiraa_id), riwaya_id: id(item.riwaya_id), tariq_id: id(item.tariq_id) };
  if (tariq_id && !riwaya_id) riwaya_id = id(T.get(tariq_id)?.riwaya_id);
  if (riwaya_id && !qiraa_id) qiraa_id = id(R.get(riwaya_id)?.qiraa_id);
  return { qiraa_id, riwaya_id, tariq_id };
}

export const itemKey = it => `${it.qiraa_id || 0}-${it.riwaya_id || 0}-${it.tariq_id || 0}`;

/**
 * «قراءة نافع › رواية ورش › طريق الأزرق» (a nested tariq shows its parents);
 * short: «نافع › ورش › الأزرق», for chips.
 */
export function itemLabel(item, lists, { short = false } = {}) {
  const { qiraat, riwayat, turuq } = lists;
  const it = completeItem(item, lists);
  const Q = byId(qiraat), R = byId(riwayat), T = byId(turuq);
  const tariqPath = [];
  for (let t = T.get(it.tariq_id), guard = 0; t && guard < 10; t = T.get(Number(t.parent_id)), guard++) tariqPath.unshift(t.name_ar);
  const parts = [Q.get(it.qiraa_id)?.name_ar, R.get(it.riwaya_id)?.name_ar, ...tariqPath].filter(Boolean);
  return (short ? parts.map(p => p.replace(/^(قراءة|رواية|طريق)\s+/, '')) : parts).join(' › ');
}

/**
 * Every qiraa, then its riwayat, then their turuq, as Combobox options:
 * { value: itemKey, label, sub, item }. The sub line says what a broader pick covers.
 */
export function scopeOptions(lists) {
  const { qiraat, riwayat, turuq } = lists;
  const out = [];
  const opt = (item, sub) => out.push({ value: itemKey(item), label: itemLabel(item, lists), sub, item });
  for (const q of qiraat) {
    opt({ qiraa_id: Number(q.id), riwaya_id: null, tariq_id: null }, 'كل الروايات');
    for (const r of riwayat.filter(x => Number(x.qiraa_id) === Number(q.id))) {
      const own = turuq.filter(t => Number(t.riwaya_id) === Number(r.id));
      opt({ qiraa_id: Number(q.id), riwaya_id: Number(r.id), tariq_id: null }, own.length ? 'كل الطرق' : undefined);
      for (const t of own) opt({ qiraa_id: Number(q.id), riwaya_id: Number(r.id), tariq_id: Number(t.id) });
    }
  }
  return out;
}

/** Adds a picked item (completed, once); a broader pick replaces the narrower ones it covers. */
export function addItem(items, item, lists) {
  const it = completeItem(item, lists);
  const covers = (wide, narrow) =>
    (!wide.qiraa_id || wide.qiraa_id === narrow.qiraa_id) &&
    (!wide.riwaya_id || wide.riwaya_id === narrow.riwaya_id) &&
    (!wide.tariq_id || wide.tariq_id === narrow.tariq_id);
  const done = items.map(x => completeItem(x, lists));
  if (done.some(x => covers(x, it))) return done;               // already covered
  return [...done.filter(x => !covers(it, x)), it];
}

/**
 * Filter value «q<id>» or «r<id>»: does this link cover it? A link with no items covers
 * everything; an item for a whole qiraa covers its riwayat.
 */
export function linkMatchesScope(link, filter, lists) {
  if (!filter) return true;
  const items = link.items || [];
  if (!items.length) return true;
  const want = Number(filter.slice(1));
  return items.some(raw => {
    const it = completeItem(raw, lists);
    if (filter[0] === 'q') return it.qiraa_id === want;
    if (it.riwaya_id) return it.riwaya_id === want;
    const r = lists.riwayat.find(x => Number(x.id) === want);
    return !!r && it.qiraa_id === Number(r.qiraa_id);
  });
}

/** Another link with the same reader and shaykh (the one being edited excluded). */
export const findDuplicate = (links, form) =>
  form.to_person_id === '' || form.to_person_id == null ? null
    : links.find(l => Number(l.from_person_id) === Number(form.from_person_id || 0)
      && Number(l.to_person_id) === Number(form.to_person_id) && Number(l.id) !== Number(form.id)) || null;
