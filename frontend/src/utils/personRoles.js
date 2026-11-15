// Who is an imam or a rawi comes from the qiraat and riwayat themselves (qiraat.imam_id, riwayat.rawi_id),
// the same fields the isnad and ijaza use; a person may hold several roles (الدوري عن أبي عمرو / عن الكسائي).
export function personRoles(qiraat = [], riwayat = []) {
  const roles = new Map();
  const add = (id, kind, label) => {
    if (id == null || id === '') return;
    const key = Number(id);
    if (!roles.has(key)) roles.set(key, []);
    roles.get(key).push({ kind, label });
  };
  qiraat.forEach(q => add(q.imam_id, 'imam', `إمام ${q.name_ar}`));
  riwayat.forEach(r => add(r.rawi_id, 'rawi', `راوي ${r.name_ar}`));
  return roles;
}

export const hasRole = (roles, id, kind) => (roles.get(Number(id)) || []).some(r => r.kind === kind);
