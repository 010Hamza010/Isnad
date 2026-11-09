// Fast entry: parsed isnad text (POST /isnad-text/parse) → reviewed choices → /isnad-text/import payload.
import { normalizeArabic } from './text.js';

export const NEW = 'new';

// The same name in several chains (a shared tail after «كلاهما») is one decision.
// Relatives («عن أبيه») depend on who precedes them, so each occurrence is its own decision.
const nodeKey = (node, ci, li) => (node.status === 'relative'
  ? `rel:${ci}:${li}`
  : `n:${normalizeArabic(node.name)}|${node.death_year || ''}`);

const defaultPick = node => {
  if (node.status === 'matched') return node.person_id;
  if (node.status === 'new') return NEW;
  return null; // ambiguous / relative: the user must choose
};

/**
 * Parse output → { chains: [{ start: key|null, links: [{ key, keyword, tx_kind, reading_mode }] }], names: { key: {...} } }
 * names[key] = { name, death_year, status, candidates, pick } where pick is a person id, NEW, or null.
 */
export function buildReview(parsedChains) {
  const names = {};
  const add = (node, ci, li) => {
    const key = nodeKey(node, ci, li);
    if (!names[key]) {
      names[key] = {
        name: node.name, death_year: node.death_year || null, status: node.status,
        candidates: node.candidates || [], pick: defaultPick(node),
      };
    }
    return key;
  };
  const chains = (parsedChains || []).map((c, ci) => ({
    start: c.start ? add(c.start, ci, -1) : null,
    links: c.links.map((l, li) => ({ key: add(l, ci, li), keyword: l.keyword, tx_kind: l.tx_kind ?? null, reading_mode: l.reading_mode ?? null })),
  }));
  return { chains, names };
}

/** Keys still waiting for a choice, in reading order. */
export const unresolved = review => Object.keys(review.names).filter(k => review.names[k].pick == null || review.names[k].pick === '');

/** Review → chains for /isnad-text/import (throws if something is unresolved). */
export function toImportChains(review) {
  const left = unresolved(review);
  if (left.length) throw new Error(`حدّد الأشخاص: ${left.map(k => review.names[k].name).join('، ')}`);
  const node = key => {
    const n = review.names[key];
    return n.pick === NEW
      ? { new_name: n.name, death_year: n.death_year }
      : { person_id: Number(n.pick), name: n.name };
  };
  return review.chains.map(c => ({
    start: c.start ? node(c.start) : null,
    links: c.links.map(l => ({ ...node(l.key), tx_kind: l.tx_kind, reading_mode: l.reading_mode })),
  }));
}

/** Combobox options for one name: «new person», then the candidates, then everyone else. */
export function pickOptions(entry, persons) {
  const seen = new Set(entry.candidates.map(c => c.id));
  return [
    { value: NEW, label: `➕ شخص جديد: ${entry.name}`, sub: entry.death_year ? `ت ${entry.death_year}` : undefined },
    ...entry.candidates.map(c => ({ value: c.id, label: c.name_ar, sub: `تطابق ${Math.round(c.score * 100)}%` })),
    ...persons.filter(p => !seen.has(p.id)).map(p => ({ value: p.id, label: p.name_ar, sub: p.death_year ? `ت ${p.death_year}` : undefined })),
  ];
}
