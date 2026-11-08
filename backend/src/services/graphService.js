function edgeCompatible(edge, riwaya_id, tariq_id, qiraa_id, pMap, imamMap, riwayaQiraaMap) {
  const items = edge.items || [];
  const isStart = Number(edge.from_person_id) === 0;

  if (items.length === 0) {
    if (qiraa_id) {
      if (pMap) {
        const toPerson = pMap.get(Number(edge.to_person_id));
        if (toPerson?.primary_qiraa_id &&
            Number(toPerson.primary_qiraa_id) !== Number(qiraa_id)) return false;
      }
      if (imamMap) {
        const personQiraa = imamMap.get(Number(edge.to_person_id));
        if (personQiraa !== undefined && Number(personQiraa) !== Number(qiraa_id)) return false;
      }
    }
    return true;
  }

  return items.some(item => {
    const itemQiraa = item.qiraa_id
      ? Number(item.qiraa_id)
      : (item.riwaya_id && riwayaQiraaMap
          ? riwayaQiraaMap.get(Number(item.riwaya_id))
          : null);

    // ── qiraa check ──
    if (qiraa_id && itemQiraa != null) {
      if (Number(itemQiraa) !== Number(qiraa_id)) return false;
    }

    // ── riwaya check ──
    if (riwaya_id && item.riwaya_id) {
      if (Number(item.riwaya_id) !== Number(riwaya_id)) return false;
    }

    // ── START EDGE: if filtering by qiraa ONLY (no riwaya),
    //    reject items that declare a specific riwaya —
    //    those belong to riwaya-level connections, not qiraa-level
    if (isStart && !riwaya_id && qiraa_id && item.riwaya_id) {
      return false;
    }

    // ── tariq check ──
    if (tariq_id && item.tariq_id) {
      if (Number(item.tariq_id) !== Number(tariq_id)) return false;
    }

    return true;
  });
}

function buildPaths(edges, startId, targetIds, riwaya_id, tariq_id, qiraa_id, pMap, imamMap, riwayaQiraaMap) {
  const targetSet = new Set(targetIds.map(Number));

  // Filter by scope first, then deduplicate: per from→to pair keep the strongest
  // transmission (lowest transmission_type_id; untyped edges rank last).
  // Filtering first matters — two edges to the same shaykh may cover different riwayat.
  const edgeMap = new Map();
  for (const edge of edges) {
    if (!edgeCompatible(edge, riwaya_id, tariq_id, qiraa_id, pMap, imamMap, riwayaQiraaMap)) continue;
    const key = `${edge.from_person_id}-${edge.to_person_id}`;
    const existing = edgeMap.get(key);
    const rank = e => Number(e.transmission_type_id) || Infinity;
    if (!existing || rank(edge) < rank(existing)) edgeMap.set(key, edge);
  }

  // adjacency list: from_person_id → outgoing edges
  const adjacency = new Map();
  for (const edge of edgeMap.values()) {
    const from = Number(edge.from_person_id);
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(edge);
  }

  const allPaths = [];
  const dfs = (currentId, path, visited) => {
    if (targetSet.has(Number(currentId))) { allPaths.push([...path]); return; }
    if (visited.size > 30) return;
    const next = adjacency.get(Number(currentId)) || [];
    for (const edge of next) {
      const toId = Number(edge.to_person_id);
      if (visited.has(toId)) continue;
      visited.add(toId);
      path.push(edge);
      dfs(toId, path, visited);
      path.pop();
      visited.delete(toId);
    }
  };
  dfs(startId, [], new Set([Number(startId)]));

  // group by first hop → { firstEdge, chains: [[edge,edge,...], ...] }
  const groups = new Map();
  for (const path of allPaths) {
    if (!path.length) continue;
    const key = `${path[0].from_person_id}-${path[0].to_person_id}`;
    if (!groups.has(key)) groups.set(key, { firstEdge: path[0], chains: [] });
    groups.get(key).chains.push(path.slice(1));
  }

  return [...groups.values()];
}

function formatPath(group, pMap) {
  const fmt = edge => ({
    from_person_id: edge.from_person_id,
    from_name: Number(edge.from_person_id) === 0
      ? 'أنا' : (pMap.get(Number(edge.from_person_id))?.name_ar || `#${edge.from_person_id}`),
    to_person_id: edge.to_person_id,
    to_name: pMap.get(Number(edge.to_person_id))?.name_ar || `#${edge.to_person_id}`,
    from_death_year: pMap.get(Number(edge.from_person_id))?.death_year || null,
    to_death_year:   pMap.get(Number(edge.to_person_id))?.death_year || null,
    to_description:  pMap.get(Number(edge.to_person_id))?.description || null,
    tx_name:     edge.tx_name     || null,
    transmission_type_id: edge.transmission_type_id ?? null,
    description: edge.description || null,
    items:       edge.items       || [],
  });

  return {
    firstEdge: fmt(group.firstEdge),
    chains: group.chains.map(chain => chain.map(fmt)),
  };
}

module.exports = { buildPaths, formatPath };