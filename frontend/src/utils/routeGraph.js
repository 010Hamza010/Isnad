import { numberRoutes, isGeneralRoute } from './chains.js';

/**
 * The routes of one matn as a graph: every route numbered «<group>.<route>» as on the isnad
 * page, every link with the routes that use it, every person with its order(s) from my shaykh.
 * Disabled routes ({ key, names }) add links marked `off` that no enabled route uses.
 */
export function routeGraph(paths, disabled = [], order = 'high') {
  const routes = [];
  const edges = new Map();
  const depths = new Map();
  const names = new Map([[0, 'أنا']]);
  const link = (from, to, extra) => {
    const k = `${from}>${to}`;
    if (!edges.has(k)) edges.set(k, { from, to, routes: [], off: true, tx: null, general: false });
    Object.assign(edges.get(k), extra(edges.get(k)));
  };

  paths.forEach((g, gi) => numberRoutes(g, order).forEach((r, ri) => {
    const label = `${gi + 1}.${ri + 1}`;
    const steps = [g.firstEdge, ...r.chain];
    routes.push({ label, key: r.key, n: r.n, general: isGeneralRoute(g.firstEdge, r.chain), ids: [0, ...steps.map(e => Number(e.to_person_id))] });
    steps.forEach((e, d) => {
      const to = Number(e.to_person_id);
      names.set(to, e.to_name);
      if (!depths.has(to)) depths.set(to, new Set());
      depths.get(to).add(d + 1);
      link(Number(e.from_person_id), to, x => ({ routes: [...x.routes, label], off: false, tx: x.tx || e.tx_name || null, general: x.general || !!e.general }));
    });
  }));

  disabled.forEach(d => {
    const ids = d.key.split('.').map(Number);
    ids.slice(1).forEach((id, i) => {
      if (!names.has(id)) names.set(id, d.names[i]);
      link(ids[i], id, () => ({}));
    });
  });

  return { routes, edges: [...edges.values()], depths, names };
}

/** Shortest order of every person from me (0) over `edges` ({ from, to }); me is 0. */
export function stepsFromMe(edges) {
  const out = new Map([[0, 0]]);
  const next = new Map();
  edges.forEach(e => { if (!next.has(e.from)) next.set(e.from, []); next.get(e.from).push(e.to); });
  const queue = [0];
  while (queue.length) {
    const id = queue.shift();
    (next.get(id) || []).forEach(t => { if (!out.has(t)) { out.set(t, out.get(id) + 1); queue.push(t); } });
  }
  return out;
}

/** «2/3 · name»: a person's order(s) before the name. */
export function numbered(name, steps) {
  const list = [...(steps || [])].sort((a, b) => a - b);
  return list.length ? `${list.join('/')} · ${name}` : name;
}
