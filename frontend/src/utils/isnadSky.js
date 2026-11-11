// «سماء الإسناد»: my network laid out in 3D for the home page. Pure (no three.js) so it can be tested.
// I am at the bottom; each person sits at the height of his fewest links from me, on a ring that
// widens with the number of persons at that height. Links go from student to shaykh (upwards).

export const SACRED = { [-1]: 'النبي ﷺ', [-2]: 'جبريل عليه السلام', [-3]: 'رب العزة' };
const LAYER = 1;          // height between generations
const MAX_RADIUS = 4.2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Arabic count of «واسطة» (1 واسطة واحدة، 2 واسطتان، 3–10 وسائط، 11+ واسطة). */
export function wasaitText(n) {
  if (n === 0) return 'بلا واسطة';
  if (n === 1) return 'واسطة واحدة';
  if (n === 2) return 'واسطتان';
  return `${n} ${n <= 10 ? 'وسائط' : 'واسطة'}`;
}

/**
 * data: /graph/full ({ persons, matnEdges, quranEdges }) →
 * { nodes: [{ id, name, depth, x, y, z, kind }], links: [[fromIndex, toIndex]], height }.
 * kind: me | shaykh (my direct shaykhs) | sacred | top (the highest persons) | person.
 * Persons that cannot be reached from me are left out.
 */
export function skyLayout(data) {
  const names = new Map((data?.persons || []).map(p => [Number(p.id), p.name_ar]));
  const up = new Map();
  const pairs = new Set();
  for (const e of [...(data?.matnEdges || []), ...(data?.quranEdges || [])]) {
    const from = Number(e.from_person_id), to = Number(e.to_person_id);
    if (from === to || pairs.has(`${from}>${to}`)) continue;
    pairs.add(`${from}>${to}`);
    if (!up.has(from)) up.set(from, []);
    up.get(from).push(to);
  }

  // fewest links from me (breadth first)
  const depth = new Map([[0, 0]]);
  let frontier = [0];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) for (const to of up.get(id) || []) {
      if (depth.has(to)) continue;
      depth.set(to, depth.get(id) + 1);
      next.push(to);
    }
    frontier = next;
  }

  const maxDepth = Math.max(...depth.values());
  const layers = [];
  for (const [id, d] of depth) (layers[d] ||= []).push(id);

  // place each layer on a ring; a person's angle follows the students below him, so threads stay untangled
  const angle = new Map([[0, 0]]);
  const below = new Map();
  for (const [from, tos] of up) for (const to of tos) {
    if (!depth.has(from) || !depth.has(to)) continue;
    if (!below.has(to)) below.set(to, []);
    below.get(to).push(from);
  }
  const pos = new Map([[0, { x: 0, y: 0, z: 0 }]]);
  for (let d = 1; d <= maxDepth; d++) {
    const ids = layers[d] || [];
    const wanted = id => {
      const a = (below.get(id) || []).filter(s => angle.has(s)).map(s => angle.get(s));
      if (!a.length) return 0;
      return Math.atan2(a.reduce((s, x) => s + Math.sin(x), 0), a.reduce((s, x) => s + Math.cos(x), 0));
    };
    ids.sort((a, b) => wanted(a) - wanted(b) || a - b);
    const radius = ids.length === 1 ? 0.35 * Math.min(d, 3) : Math.min(MAX_RADIUS, 0.6 + 0.32 * ids.length);
    const start = ids.length ? wanted(ids[0]) : 0;
    ids.forEach((id, i) => {
      const a = ids.length === 1 ? start + d * GOLDEN : start + (i / ids.length) * Math.PI * 2;
      angle.set(id, a);
      pos.set(id, { x: Math.cos(a) * radius, y: d * LAYER, z: Math.sin(a) * radius });
    });
  }

  const ids = [...depth.keys()].sort((a, b) => depth.get(a) - depth.get(b) || a - b);
  const index = new Map(ids.map((id, i) => [id, i]));
  const top = new Set(maxDepth > 1 ? layers[maxDepth] : []);
  const nodes = ids.map(id => ({
    id, depth: depth.get(id), ...pos.get(id),
    name: id === 0 ? 'أنا' : SACRED[id] || names.get(id) || `#${id}`,
    kind: id === 0 ? 'me' : id < 0 ? 'sacred' : depth.get(id) === 1 ? 'shaykh' : top.has(id) ? 'top' : 'person',
  }));
  const links = [];
  for (const [from, tos] of up) for (const to of tos) {
    if (index.has(from) && index.has(to) && depth.get(to) > depth.get(from)) links.push([index.get(from), index.get(to)]);
  }
  return { nodes, links, height: maxDepth * LAYER };
}
