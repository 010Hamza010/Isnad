/**
 * The Quran isnad of one riwaya (or a qiraa without riwayat):
 *   me → … (my links, then my shaykhs' links) → the rawi
 *      → the imam            (links entered from the rawi up, else one direct step: most rawis read on him)
 *      → … → النبي ﷺ          (links entered from the imam up, else a jump marked منقطع)
 *      → جبريل → رب العزة     (always)
 * Only MY links decide what I hold (what was read, and the tariq); every link above them counts as
 * complete: those shaykhs read everything on their shaykhs. No العشر الصغرى / الكبرى logic for now.
 */
const { HttpError } = require('../utils/httpError');

const PROPHET = -1;

const TAIL = [
  { from_person_id: -1, to_person_id: -2, from_name: 'النبي ﷺ', to_name: 'جبريل عليه السلام',
    tx_name: 'وحي', description: 'تلقى النبي ﷺ القرآن من جبريل عليه السلام', items: [] },
  { from_person_id: -2, to_person_id: -3, from_name: 'جبريل عليه السلام', to_name: 'رب العزة',
    tx_name: 'وحي', description: 'جبريل أمين الوحي نزل به من عند الله', items: [] },
];

/**
 * Does my own link cover this choice? A link with nothing chosen covers nothing.
 * want: { qiraa_id, riwaya_id, tariq } — tariq undefined = any, 0 = links without a tariq, id = that tariq.
 * A whole-qiraa item covers each of its riwayat (without a tariq).
 */
function startCovers(edge, want, riwayaQiraa) {
  return (edge.items || []).some(it => {
    const q = it.qiraa_id ? Number(it.qiraa_id) : it.riwaya_id ? riwayaQiraa.get(Number(it.riwaya_id)) ?? null : null;
    if (want.riwaya_id) {
      if (it.riwaya_id ? Number(it.riwaya_id) !== Number(want.riwaya_id) : q == null || q !== Number(want.qiraa_id)) return false;
    } else if (want.qiraa_id) {
      if (q !== Number(want.qiraa_id)) return false;
    } else return false;
    if (want.tariq === undefined) return true;
    return want.tariq === 0 ? !it.tariq_id : Number(it.tariq_id) === Number(want.tariq);
  });
}

/**
 * A link above mine: does it carry this choice? «عام» carries everything; otherwise one of its
 * items must (a whole qiraa carries each of its riwayat; a tariq does not matter above me).
 */
function upperCovers(edge, want, riwayaQiraa) {
  if (Number(edge.is_general)) return true;
  if (!want.riwaya_id && !want.qiraa_id) return false;
  return startCovers(edge, { ...want, tariq: undefined }, riwayaQiraa);
}

/** A link to save: names what was read, or is «عام» (not mine). → is_general (0/1), or throws 400. */
function checkScope(body) {
  const mine = Number(body?.from_person_id || 0) === 0;
  const items = (body?.items || []).filter(it => it && (it.qiraa_id || it.riwaya_id || it.tariq_id));
  const general = !mine && !!Number(body?.is_general);
  if (mine && !items.length) throw new HttpError(400, 'حدّد ما قرأتَ على شيخك');
  if (!general && !items.length) throw new HttpError(400, 'حدّد ما قُرئ، أو اختر «عام — كل القراءات»');
  return general ? 1 : 0;
}

/** Simple paths from → to over the links above me (each an array of edges), at most `limit`. */
function segments(adjacency, from, to, limit = 20) {
  const out = [];
  const walk = (id, path, seen) => {
    if (out.length >= limit) return;
    if (id === to) { out.push([...path]); return; }
    if (path.length > 30) return;
    for (const e of adjacency.get(id) || []) {
      const next = Number(e.to_person_id);
      if (seen.has(next)) continue;
      seen.add(next); path.push(e);
      walk(next, path, seen);
      path.pop(); seen.delete(next);
    }
  };
  walk(Number(from), [], new Set([Number(from)]));
  return out;
}

/**
 * The part above the target of my routes: [[edge…]] alternatives, each ending with the sacred tail.
 * upper: links not from me; fmt(edge) formats an entered link; step(from, to, extra) builds a made-up one.
 */
function above({ rawiId, imamId, upper, fmt, step }) {
  const adjacency = new Map();
  for (const e of upper) {
    const from = Number(e.from_person_id);
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(e);
  }
  const toImam = rawiId && imamId && Number(rawiId) !== Number(imamId)
    ? (segments(adjacency, rawiId, Number(imamId)).map(s => s.map(fmt)).filter(s => s.length) || [])
    : [[]];
  const viaRawi = toImam.length ? toImam : [[step(rawiId, imamId, { auto: true })]];
  const top = imamId ?? rawiId;
  const toProphet = top == null || Number(top) === PROPHET ? [[]]
    : (() => {
      const found = segments(adjacency, top, PROPHET).map(s => s.map(fmt));
      return found.length ? found : [[step(top, PROPHET, { munqati: true })]];
    })();
  return viaRawi.flatMap(a => toProphet.map(b => [...a, ...b, ...TAIL.map(t => ({ ...t }))]));
}

/** Groups (formatted, with keys) whose chains are completed by every alternative above the target. */
function completeGroups(groups, alternatives) {
  return groups.map(g => {
    const chains = [], keys = [];
    g.chains.forEach((c, i) => alternatives.forEach(a => { chains.push([...c, ...a]); keys.push(g.keys?.[i]); }));
    return { ...g, chains, ...(g.keys ? { keys } : {}) };
  });
}

module.exports = { startCovers, upperCovers, checkScope, segments, above, completeGroups, TAIL, PROPHET };
