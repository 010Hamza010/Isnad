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

  // deduplicate edges: keep highest transmission_type_id per from→to pair
  const edgeMap = new Map();
  for (const edge of edges) {
    const key = `${edge.from_person_id}-${edge.to_person_id}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, edge);
    } else {
      const existing = edgeMap.get(key);
      const existingTx = Number(existing.transmission_type_id) || 10;
      const newTx      = Number(edge.transmission_type_id)     || 10;
      if (newTx < existingTx) edgeMap.set(key, edge);
    }
  }
  const dedupedEdges = [...edgeMap.values()];

  const allPaths = [];
  const dfs = (currentId, path, visited) => {
    if (targetSet.has(Number(currentId))) { allPaths.push([...path]); return; }
    if (visited.size > 30) return;
    const next = dedupedEdges.filter(e =>
      Number(e.from_person_id) === Number(currentId) &&
      edgeCompatible(e, riwaya_id, tariq_id, qiraa_id, pMap, imamMap, riwayaQiraaMap)
    );
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
    tx_name:     edge.tx_name     || null,
    description: edge.description || null,
    items:       edge.items       || [],
  });

  return {
    firstEdge: fmt(group.firstEdge),
    chains: group.chains.map(chain => chain.map(fmt)),
  };
}

module.exports = { buildPaths, formatPath };