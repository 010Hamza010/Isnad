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

/**
 * Distinct riwayat of my own links, a whole qiraa counting as each of its riwayat (riwayat: rows
 * { id, qiraa_id, name_ar }), or the qiraa itself when it has no riwayat. Links naming nothing count for nothing.
 */
function quranOptions(rows, riwayat = []) {
  const seen = new Map();
  const add = (key, o) => { if (!seen.has(key)) seen.set(key, o); };
  for (const r of rows) {
    if (r.riwaya_id) {
      add(`r${r.riwaya_id}`, { riwaya_id: Number(r.riwaya_id), label: [r.riwaya_name, r.qiraa_name].filter(Boolean).join(' — ') });
    } else if (r.qiraa_id) {
      const own = riwayat.filter(x => Number(x.qiraa_id) === Number(r.qiraa_id));
      if (!own.length) add(`q${r.qiraa_id}`, { qiraa_id: Number(r.qiraa_id), label: r.qiraa_name || '' });
      own.forEach(x => add(`r${x.id}`, { riwaya_id: Number(x.id), label: [x.name_ar, r.qiraa_name].filter(Boolean).join(' — ') }));
    }
  }
  return [...seen.values()];
}

module.exports = { fewest, byHeight, quranOptions };
