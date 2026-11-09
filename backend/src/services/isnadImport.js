/**
 * Fast entry: reviewed parse output → new persons + direct connections.
 * Pure planning; the model applies the plan in one transaction.
 *
 * A node is { person_id } (existing person, 0 = me, negatives = sacred tail)
 * or { new_name, death_year?, gender? } (to be created).
 * A chain is { start: node|null (null = me), links: [{ ...node, tx_kind, reading_mode }] }.
 */
const { normalizeArabic } = require('./isnadText/normalize');
const { kindOf } = require('./txKinds');

class ImportError extends Error {}

const MODES = new Set(['heart', 'looking']);

/** The transmission type for a kind: lowest id among types of that kind usable for the target. */
function pickType(types, kind, target) {
  if (!kind) return null;
  const scope = target === 'quran' ? 'quran' : 'mutoon';
  const hit = types
    .filter(t => kindOf(t) === kind && (!t.applies_to || t.applies_to === 'both' || t.applies_to === scope))
    .sort((a, b) => a.id - b.id)[0];
  return hit ? hit.id : null;
}

// «852هـ» → «852» (render adds هـ to plain numbers); anything else is kept as written
const cleanYear = y => {
  const s = String(y ?? '').trim();
  const d = s.replace(/\s*هـ?$/, '');
  return /^\d+$/.test(d) ? d : s || null;
};
const newKey = n => `new:${normalizeArabic(n.new_name)}|${cleanYear(n.death_year) || ''}`;

function nodeOf(n, where, newPersons) {
  if (n && n.person_id !== undefined && n.person_id !== null && n.person_id !== '') {
    const id = Number(n.person_id);
    if (!Number.isInteger(id)) throw new ImportError(`${where}: معرّف غير صالح`);
    return { ref: id, name: n.name ?? null };
  }
  const name = String(n?.new_name ?? '').trim();
  if (!name) throw new ImportError(`${where}: لم يُحدَّد الشخص`);
  const key = newKey(n);
  if (!newPersons.has(key)) {
    newPersons.set(key, {
      key, name_ar: name,
      death_year: cleanYear(n.death_year),
      gender: n.gender === 'F' ? 'F' : 'M',
    });
  }
  return { ref: key, name };
}

/**
 * chains → { persons: [new person], edges: [{ from, to, from_name, to_name, tx_kind, transmission_type_id, reading_mode, exists }] }
 * `from`/`to` are person ids or new-person keys. Repeated edges (a shared tail after «كلاهما») appear once.
 * `existing` is a Set of "from:to" pairs already in the database for this target.
 */
function planImport(chains, { types = [], target = 'matn', existing = new Set() } = {}) {
  if (!Array.isArray(chains) || !chains.length) throw new ImportError('لا توجد أسانيد للحفظ');
  const newPersons = new Map();
  const edges = new Map();

  chains.forEach((c, ci) => {
    if (!Array.isArray(c?.links) || !c.links.length) throw new ImportError(`السند ${ci + 1}: لا اتصالات فيه`);
    let from = c.start ? nodeOf(c.start, `السند ${ci + 1}، بدايته`, newPersons) : { ref: 0, name: 'أنا' };
    c.links.forEach((l, li) => {
      const where = `السند ${ci + 1}، الحلقة ${li + 1}`;
      const to = nodeOf(l, where, newPersons);
      if (to.ref === 0) throw new ImportError(`${where}: لا يمكن ربط اتصال إليك`);
      if (to.ref === from.ref) throw new ImportError(`${where}: لا يمكن أن يتصل الشخص بنفسه`);
      if (l.reading_mode && !MODES.has(l.reading_mode)) throw new ImportError(`${where}: طريقة القراءة غير صالحة`);
      const id = `${from.ref}:${to.ref}`;
      if (!edges.has(id)) {
        edges.set(id, {
          from: from.ref, to: to.ref, from_name: from.name, to_name: to.name,
          tx_kind: l.tx_kind || null,
          transmission_type_id: pickType(types, l.tx_kind, target),
          reading_mode: l.reading_mode || null,
          exists: typeof from.ref === 'number' && typeof to.ref === 'number' && existing.has(id),
        });
      }
      from = to;
    });
  });

  return { persons: [...newPersons.values()], edges: [...edges.values()] };
}

module.exports = { planImport, pickType, ImportError };
