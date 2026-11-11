/**
 * The isnad of a group («العشر الصغرى») for an ijaza. My links read with the group carry it up to
 * the meeting point: the last shaykh whose links still carry the whole group (usually ابن الجزري).
 * What follows is the user's choice (ijaza settings, overridable per ijaza):
 *   stop   — the chains stop there, followed by the stop text («بأسانيده … إلى الأئمة»);
 *   all    — every member's own isnad (one per imam), joined with ح;
 *   riwaya — the isnad of one riwaya of the group (default حفص).
 */
const { upperCovers } = require('./quranChain');
const { normalizeArabic } = require('./isnadText/normalize');

const MODES = ['stop', 'all', 'riwaya'];
const STOP_MARK = -9;   // the made-up last step that carries the stop text (never a person)

const hasGroup = (edge, groupId) => (edge.groups || []).some(g => Number(g.group_id ?? g) === Number(groupId));

/** The riwayat a group covers: its riwaya members, and every riwaya of its qiraa members. */
function groupRiwayat(group, riwayat) {
  const seen = new Set();
  return (group.items || []).flatMap(m => (m.riwaya_id
    ? riwayat.filter(r => Number(r.id) === Number(m.riwaya_id))
    : riwayat.filter(r => Number(r.qiraa_id) === Number(m.qiraa_id))))
    .filter(r => !seen.has(Number(r.id)) && seen.add(Number(r.id)));
}

/**
 * Does a link above me carry the whole group? «عام», the group itself, or every member named
 * (a qiraa member needs the whole qiraa, or each of its riwayat). edge.items: with its groups expanded.
 */
function carriesGroup(edge, group, riwayat, riwayaQiraa) {
  if (Number(edge.is_general) || hasGroup(edge, group.id)) return true;
  return (group.items || []).every(m => {
    if (m.riwaya_id) return upperCovers(edge, { riwaya_id: Number(m.riwaya_id), qiraa_id: riwayaQiraa.get(Number(m.riwaya_id)) ?? null }, riwayaQiraa);
    const q = Number(m.qiraa_id);
    if ((edge.items || []).some(it => !it.riwaya_id && Number(it.qiraa_id) === q)) return true;
    const own = riwayat.filter(r => Number(r.qiraa_id) === q);
    return own.length > 0 && own.every(r => (edge.items || []).some(it => Number(it.riwaya_id) === Number(r.id)));
  });
}

/** The meeting points: persons reached from me over carrying links with no carrying link above them. */
function meetingPoints(mine, upper) {
  const out = new Map();
  upper.forEach(e => { const f = Number(e.from_person_id); if (!out.has(f)) out.set(f, []); out.get(f).push(Number(e.to_person_id)); });
  const seen = new Set();
  const stack = mine.map(e => Number(e.to_person_id));
  const ends = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const next = out.get(id) || [];
    if (!next.length) ends.add(id); else stack.push(...next);
  }
  return [...ends];
}

/** The riwaya to continue with: the wanted one if the group covers it, else حفص, else the first. */
function chooseRiwaya(choices, wanted) {
  if (!choices.length) return null;
  const hit = choices.find(r => Number(r.id) === Number(wanted));
  if (hit) return Number(hit.id);
  const hafs = choices.find(r => normalizeArabic(r.name_ar).includes('حفص'));
  return Number((hafs || choices[0]).id);
}

/** Each chain of the path groups ends with the stop step: the renderer writes «، <text>» after it. */
function withStop(paths, text) {
  const stop = last => ({ from_person_id: last.to_person_id, from_name: last.to_name, to_person_id: STOP_MARK, to_name: '',
    group_stop: true, note: text, items: [] });
  return paths.map(g => ({
    ...g,
    chains: (g.chains.length ? g.chains : [[]]).map(c => [...c, stop(c.length ? c[c.length - 1] : g.firstEdge)]),
  }));
}

module.exports = { MODES, STOP_MARK, hasGroup, groupRiwayat, carriesGroup, meetingPoints, chooseRiwaya, withStop };
