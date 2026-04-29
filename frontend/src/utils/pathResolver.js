// Client-side path resolver (mirrors backend logic)
export function findPaths(fromId, targetId, edges, visited = new Set(), depth = 0) {
  if (depth > 15) return [];
  if (fromId === targetId) return [[]];
  const v = new Set(visited); v.add(fromId);
  const next = edges.filter(e => e.from_person_id === fromId && !v.has(e.to_person_id));
  const paths = [];
  for (const edge of next) {
    for (const sub of findPaths(edge.to_person_id, targetId, edges, v, depth + 1))
      paths.push([edge, ...sub]);
  }
  return paths;
}
