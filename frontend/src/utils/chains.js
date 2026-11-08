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
