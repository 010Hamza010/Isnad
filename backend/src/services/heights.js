/**
 * «أعلى أسانيدك»: how high (عالٍ) each isnad is, as the fewest persons between me and the target
 * (the author of a matn, or the Prophet ﷺ for the Quran) over the enabled routes.
 */

/**
 * groups: formatted /graph paths ({ firstEdge, chains }); targetId: stop at this person
 * (null = the end of each chain). → { wasait, routes } or null when no route reaches it.
 * wasait counts the persons strictly between me and the target; routes counts the chains reaching it.
 */
function fewest(groups, targetId = null) {
  let wasait = null, routes = 0;
  for (const g of groups || []) {
    for (const chain of g.chains?.length ? g.chains : [[]]) {
      const edges = [g.firstEdge, ...chain];
      const n = targetId == null ? edges.length : edges.findIndex(e => Number(e.to_person_id) === Number(targetId)) + 1;
      if (n <= 0) continue;
      routes++;
      wasait = wasait == null ? n - 1 : Math.min(wasait, n - 1);
    }
  }
  return wasait == null ? null : { wasait, routes };
}

/** Highest (fewest wasait) first, then by name. */
const byHeight = rows => [...rows].sort((a, b) => a.wasait - b.wasait || String(a.label).localeCompare(String(b.label), 'ar'));

/** Distinct Quran options of my own links: a riwaya, or a qiraa when the link names no riwaya. */
function quranOptions(rows) {
  const seen = new Map();
  for (const r of rows) {
    const key = r.riwaya_id ? `r${r.riwaya_id}` : r.qiraa_id ? `q${r.qiraa_id}` : null;
    if (!key || seen.has(key)) continue;
    seen.set(key, r.riwaya_id
      ? { riwaya_id: Number(r.riwaya_id), label: [r.riwaya_name, r.qiraa_name].filter(Boolean).join(' — ') }
      : { qiraa_id: Number(r.qiraa_id), label: r.qiraa_name || '' });
  }
  return [...seen.values()];
}

module.exports = { fewest, byHeight, quranOptions };
