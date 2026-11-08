/**
 * Layered layout of isnad chains for the tree diagram.
 * Level = longest distance from me (0), so every teacher sits above all of their students.
 * Order within a level uses a few barycenter sweeps to reduce crossings.
 */
export function layoutTree(chains) {
  const nodes = new Map();
  const edges = new Map();
  const add = (id, name, death) => {
    if (!nodes.has(id)) nodes.set(id, { id, name: name || (id === 0 ? 'أنا' : `#${id}`), death: death || null, level: 0, order: 0 });
    else if (death && !nodes.get(id).death) nodes.get(id).death = death;
  };

  (chains || []).forEach(chain => chain.forEach(e => {
    const f = Number(e.from_person_id), t = Number(e.to_person_id);
    add(f, f === 0 ? 'أنا' : e.from_name, e.from_death_year);
    add(t, e.to_name, e.to_death_year);
    if (f !== t) edges.set(`${f}>${t}`, { from: f, to: t, tx: e.tx_name || null });
  }));

  // longest-path levels; the iteration cap guards against cycles in bad data
  for (let i = 0; i < nodes.size; i++) {
    let changed = false;
    edges.forEach(({ from, to }) => {
      const l = nodes.get(from).level + 1;
      if (l > nodes.get(to).level && l < nodes.size) { nodes.get(to).level = l; changed = true; }
    });
    if (!changed) break;
  }

  const maxLevel = Math.max(0, ...[...nodes.values()].map(n => n.level));
  const rows = Array.from({ length: maxLevel + 1 }, () => []);
  nodes.forEach(n => rows[n.level].push(n)); // insertion order = first appearance
  const reindex = () => rows.forEach(r => r.forEach((n, i) => { n.order = i - (r.length - 1) / 2; }));
  reindex();

  const preds = id => [...edges.values()].filter(e => e.to === id).map(e => nodes.get(e.from));
  const succs = id => [...edges.values()].filter(e => e.from === id).map(e => nodes.get(e.to));
  const bary = (n, rel) => {
    const r = rel(n.id);
    return r.length ? r.reduce((s, x) => s + x.order, 0) / r.length : n.order;
  };
  for (let sweep = 0; sweep < 4; sweep++) {
    const up = sweep % 2 === 0;
    const range = up ? rows.slice(1) : rows.slice(0, -1).reverse();
    range.forEach(r => {
      const key = new Map(r.map(n => [n.id, bary(n, up ? preds : succs)]));
      r.sort((a, b) => key.get(a.id) - key.get(b.id));
      r.forEach((n, i) => { n.order = i - (r.length - 1) / 2; });
    });
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    maxLevel,
    width: Math.max(1, ...rows.map(r => r.length)),
  };
}

/** First sentence(s) of a biography that fit in a margin note. */
export function shortBio(text, max = 240) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('،'), cut.lastIndexOf('؛'));
  return `${(end > max * 0.5 ? cut.slice(0, end) : cut.slice(0, cut.lastIndexOf(' '))).trim()}…`;
}
