/**
 * The isnad of a group («العشر الصغرى») or a whole qiraa for an ijaza, through my links read with it.
 * How far it goes is the user's choice (ijaza settings, overridable per ijaza):
 *   stop   — each chain stops at the first stop point it reaches (settings: ابن الجزري «وإسناده موجود في
 *            كتابه النشر…», الداني for «العشر النافعية»), else is written whole;
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

/** The riwaya to continue with: the wanted one if the group covers it, else حفص, else the first. */
function chooseRiwaya(choices, wanted) {
  if (!choices.length) return null;
  const hit = choices.find(r => Number(r.id) === Number(wanted));
  if (hit) return Number(hit.id);
  const hafs = choices.find(r => normalizeArabic(r.name_ar).includes('حفص'));
  return Number((hafs || choices[0]).id);
}

/**
 * The stop points for this group (settings quran_group.stops): those named for it when there are any
 * («العشر النافعية» → الداني), else those for every group (ابن الجزري). A whole qiraa has no name here.
 */
function stopsFor(stops, groupName) {
  const names = x => String(x.groups || '').split(/[,،]/).map(n => normalizeArabic(n.trim())).filter(Boolean);
  const mine = groupName ? stops.filter(x => names(x).includes(normalizeArabic(groupName))) : [];
  return mine.length ? mine : stops.filter(x => !names(x).length);
}

/**
 * Each chain cut after the first stop point it reaches («… على ابن الجزري، وإسناده موجود في كتابه النشر»),
 * the same cut chains once; a chain that does not pass through one stays whole.
 * stopOf(personId) → text | null.
 */
function cutAtStops(paths, stopOf) {
  const seen = new Set();
  const groups = new Map();
  paths.forEach(g => (g.chains.length ? g.chains : [[]]).forEach(c => {
    let full = [g.firstEdge, ...c];
    const i = full.findIndex(e => stopOf(e.to_person_id) != null);
    if (i >= 0) {
      const at = full[i];
      full = [...full.slice(0, i + 1), { from_person_id: at.to_person_id, from_name: at.to_name, to_person_id: STOP_MARK, to_name: '',
        group_stop: true, note: stopOf(at.to_person_id), items: [] }];
    }
    const key = full.map(e => e.to_person_id).join('>');
    if (seen.has(key)) return;
    seen.add(key);
    const fk = `${full[0].from_person_id}-${full[0].to_person_id}`;
    if (!groups.has(fk)) groups.set(fk, { ...g, firstEdge: full[0], chains: [] });
    groups.get(fk).chains.push(full.slice(1));
  }));
  return [...groups.values()];
}

module.exports = { MODES, STOP_MARK, hasGroup, groupRiwayat, carriesGroup, chooseRiwaya, stopsFor, cutAtStops };
