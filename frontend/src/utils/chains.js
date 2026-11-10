const toKey   = e => `${e.to_person_id}`;
const edgeKey = e => `${e.from_person_id}-${e.to_person_id}`;

// Longest shared tail of all chains, compared on the person reached at each step.
export function commonSuffix(chains) {
  if (!chains.length) return [];
  if (chains.length === 1) return chains[0];
  const keys = chains.map(c => c.map(toKey));
  const minLen = Math.min(...chains.map(c => c.length));
  let len = 0;
  for (let i = 1; i <= minLen; i++) {
    const k = keys[0][keys[0].length - i];
    if (keys.every(ks => ks[ks.length - i] === k)) len = i; else break;
  }
  return len ? chains[0].slice(chains[0].length - len) : [];
}

/**
 * Split alternative chains into a shared prefix, the diverging middles and a shared suffix
 * so the UI can draw one trunk that forks and re-joins.
 */
export function splitChains(chains) {
  if (!chains.length) return { prefix: [], branches: [], suffix: [] };
  if (chains.length === 1) return { prefix: chains[0], branches: [], suffix: [] };

  const keys = chains.map(c => c.map(edgeKey));
  const minLen = Math.min(...chains.map(c => c.length));
  let prefixLen = 0;
  for (let i = 0; i < minLen; i++) {
    if (keys.every(k => k[i] === keys[0][i])) prefixLen = i + 1; else break;
  }

  const prefix  = chains[0].slice(0, prefixLen);
  const trimmed = chains.map(c => c.slice(prefixLen));
  const suffix  = commonSuffix(trimmed);
  const branches = trimmed
    .map(c => c.slice(0, c.length - suffix.length))
    .filter(b => b.length);

  return { prefix, branches, suffix };
}

const uniqSorted = xs => [...new Set(xs)].sort((a, b) => a - b);

/**
 * Nested version of splitChains: routes are drawn once where they agree and fork wherever they
 * diverge, at any depth — shared start, then one fork per distinct next step (each split again
 * recursively), then the shared tail where they re-join.
 *   { prefix: [step], forks: [{ routes, tree | null }], suffix: [step] },  step = { edge, depths }
 * `routes` are the route numbers of `chains` (same order); `start` is the depth of the chains'
 * first edge (1 = my shaykh). A fork with tree null is a route that goes straight to the tail.
 * `depths` lists every distance from me at which a step is reached (a shared tail after
 * branches of different lengths has several).
 */
export function routeTree(chains, routes = chains.map((_, i) => i + 1), start = 1) {
  const step = (edge, depths) => ({ edge, depths: uniqSorted(depths) });
  if (!chains.length) return { prefix: [], forks: [], suffix: [] };
  if (chains.length === 1) return { prefix: chains[0].map((e, i) => step(e, [start + i])), forks: [], suffix: [] };

  const keys = chains.map(c => c.map(edgeKey));
  const minLen = Math.min(...chains.map(c => c.length));
  let p = 0;
  while (p < minLen && keys.every(k => k[p] === keys[0][p])) p++;
  const prefix = chains[0].slice(0, p).map((e, i) => step(e, [start + i]));

  const rest = chains.map(c => c.slice(p));
  const restMin = Math.min(...rest.map(c => c.length));
  let s = 0;
  while (s < restMin && rest.every(c => toKey(c[c.length - 1 - s]) === toKey(rest[0][rest[0].length - 1 - s]))) s++;
  const middles = rest.map(c => c.slice(0, c.length - s));
  if (middles.every(m => !m.length)) return { prefix: chains[0].map((e, i) => step(e, [start + i])), forks: [], suffix: [] }; // duplicates

  const groups = new Map();
  middles.forEach((m, i) => {
    const k = m.length ? edgeKey(m[0]) : '';
    if (!groups.has(k)) groups.set(k, { routes: [], chains: [] });
    groups.get(k).routes.push(routes[i]);
    groups.get(k).chains.push(m);
  });
  const forks = [...groups.values()].map(g => ({
    routes: g.routes,
    tree: g.chains[0].length ? routeTree(g.chains, g.routes, start + p) : null,
  }));

  const tail = rest[0].slice(rest[0].length - s);
  const suffix = tail.map((e, j) => step(e, middles.map(m => start + p + m.length + j)));
  return { prefix, forks, suffix };
}

/**
 * Routes of one group, numbered: { chain, key, n } with n = narrators from my shaykh to the source.
 * order 'high' puts the shortest (highest, عالٍ) first; 'entry' keeps the order they were found.
 */
export function numberRoutes(group, order = 'high') {
  const list = group.chains.map((chain, i) => ({ chain, key: group.keys?.[i] ?? String(i), n: chain.length + 1, i }));
  if (order === 'high') list.sort((a, b) => a.n - b.n || a.i - b.i);
  return list;
}

/**
 * True when my own link to my shaykh is valid for every matn («عام»): the whole route then rests on
 * that general permission. Higher up «عام» is only the scope of a link, not how it was received
 * (an untyped link is «عن», taken as heard), so it never makes a route general.
 */
export const isGeneralRoute = firstEdge => !!firstEdge?.general;
