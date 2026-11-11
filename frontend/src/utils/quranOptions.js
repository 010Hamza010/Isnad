import { isMe } from './text.js';
import { readingWords, groupReading } from './ijaza.js';

/**
 * «أسانيدي» for the Quran: what my own links name, one entry per riwaya, grouped by qiraa label:
 * [[qiraaLabel, [option]]]. A whole qiraa counts as each of its riwayat (or as itself when it has
 * none); a link naming nothing gives nothing. Links of one riwaya without a tariq make one entry;
 * links labelled with a tariq make one entry per tariq.
 * option: { key, qiraa_id, riwaya_id, tariq_id, qiraaLabel, riwayaLabel, tariqLabel, teachers }
 * (tariq_id 0 = my links of that riwaya without a tariq).
 */
export function quranOptions(conns, { qiraat, riwayat, turuq, groups = [] }) {
  const qMap = new Map(qiraat.map(q => [Number(q.id), q]));
  const rMap = new Map(riwayat.map(r => [Number(r.id), r]));
  const tMap = new Map(turuq.map(t => [Number(t.id), t]));
  const seen = new Map();

  const add = (conn, qiraa_id, riwaya_id, tariq_id) => {
    const key = riwaya_id ? `r${riwaya_id}-t${tariq_id}` : `q${qiraa_id}`;
    if (!seen.has(key)) seen.set(key, {
      key, qiraa_id, riwaya_id, tariq_id,
      qiraaLabel:  qMap.get(Number(qiraa_id))?.name_ar || '',
      riwayaLabel: riwaya_id ? rMap.get(Number(riwaya_id))?.name_ar || null : null,
      tariqLabel:  tariq_id ? tMap.get(Number(tariq_id))?.name_ar || null : null,
      teachers: [],
    });
    const opt = seen.get(key);
    if (!opt.teachers.includes(conn.to_name)) opt.teachers.push(conn.to_name);
  };

  const groupsById = new Map((groups || []).map(g => [Number(g.id), g]));
  conns.filter(c => isMe(c.from_person_id)).forEach(conn => {
    // a group counts as its members (qiraat or riwayat)
    const fromGroups = (conn.groups || []).flatMap(g => groupsById.get(Number(g.group_id ?? g))?.items || []);
    [...(conn.items || []), ...fromGroups].forEach(it => {
      const tariq = it.tariq_id ? tMap.get(Number(it.tariq_id)) : null;
      const riwaya_id = Number(it.riwaya_id || tariq?.riwaya_id) || null;
      const qiraa_id = Number(rMap.get(riwaya_id)?.qiraa_id || it.qiraa_id) || null;
      if (riwaya_id) return add(conn, qiraa_id, riwaya_id, Number(it.tariq_id) || 0);
      if (!qiraa_id) return;
      const own = riwayat.filter(r => Number(r.qiraa_id) === qiraa_id);
      if (!own.length) return add(conn, qiraa_id, null, 0);
      own.forEach(r => add(conn, qiraa_id, Number(r.id), 0));
    });
  });

  const grouped = new Map();
  [...seen.values()]
    .sort((a, b) => (a.qiraa_id - b.qiraa_id) || (a.riwaya_id - b.riwaya_id) || (a.tariq_id - b.tariq_id))
    .forEach(o => { if (!grouped.has(o.qiraaLabel)) grouped.set(o.qiraaLabel, []); grouped.get(o.qiraaLabel).push(o); });
  return [...grouped.entries()];
}

/**
 * The groups my own links were read with, as ijaza options:
 * [{ key: 'g<id>', group_id, groupLabel, groupText, books, teachers }]. books: those of my links
 * read with the group (they include the group's own), once each.
 */
export function quranGroupOptions(conns, groups = []) {
  const byId = new Map(groups.map(g => [Number(g.id), g]));
  const seen = new Map();
  conns.filter(c => isMe(c.from_person_id)).forEach(conn => (conn.groups || []).forEach(ref => {
    const id = Number(ref.group_id ?? ref);
    const g = byId.get(id) || ref;
    if (!seen.has(id)) seen.set(id, { key: `g${id}`, group_id: id, groupLabel: g.name_ar, groupText: g.text_ar || g.name_ar, books: [], teachers: [] });
    const opt = seen.get(id);
    (conn.books || []).forEach(b => { if (!opt.books.some(x => Number(x.matn_id) === Number(b.matn_id))) opt.books.push(b); });
    if (!opt.teachers.includes(conn.to_name)) opt.teachers.push(conn.to_name);
  }));
  return [...seen.values()].sort((a, b) => String(a.groupLabel).localeCompare(String(b.groupLabel), 'ar'));
}

/** Query string for /graph/quran/paths (tariq_id=0: my links of the riwaya without a tariq). */
export function quranPathParams(opt) {
  const p = new URLSearchParams();
  if (opt.riwaya_id) {
    p.append('riwaya_id', opt.riwaya_id);
    if (opt.tariq_id != null) p.append('tariq_id', opt.tariq_id);
  } else if (opt.qiraa_id) p.append('qiraa_id', opt.qiraa_id);
  return p.toString();
}

/** Flatten /graph/*\/paths groups into full chains for the text renderer. */
export const groupsToChains = groups =>
  groups.flatMap(g => (g.chains.length ? g.chains.map(c => [g.firstEdge, ...c]) : [[g.firstEdge]]));

/**
 * Everything an ijaza can be given for, from my own links: groups, whole qiraat (a link naming all of
 * a qiraa that has riwayat, or a group holding it) and riwayat / turuq (quranOptions). Each:
 * { key, kind: 'group'|'whole'|'riwaya', label (no «ب»), name (for the picker), books, readOption,
 *   url (its paths), qiraa_id }.
 */
export function ijazaChoices(conns, lists) {
  const { qiraat, riwayat, groups = [] } = lists;
  const out = quranGroupOptions(conns, groups).map(o => ({
    key: o.key, kind: 'group', label: o.groupText, name: `◆ ${o.groupLabel}`, books: o.books,
    readOption: { group_id: o.group_id }, url: `/graph/quran/group-paths?group_id=${o.group_id}`,
  }));
  const withRiwayat = new Set(riwayat.map(r => Number(r.qiraa_id)));
  const byGroup = new Map(groups.map(g => [Number(g.id), g]));
  const whole = new Set();
  conns.filter(c => isMe(c.from_person_id)).forEach(c => {
    (c.items || []).forEach(it => { if (it.qiraa_id && !it.riwaya_id && !it.tariq_id) whole.add(Number(it.qiraa_id)); });
    (c.groups || []).forEach(ref => (byGroup.get(Number(ref.group_id ?? ref))?.items || []).forEach(m => { if (m.qiraa_id && !m.riwaya_id) whole.add(Number(m.qiraa_id)); }));
  });
  qiraat.filter(q => whole.has(Number(q.id)) && withRiwayat.has(Number(q.id))).forEach(q => out.push({
    key: `w${q.id}`, kind: 'whole', qiraa_id: Number(q.id), label: readingWords(q.name_ar), name: `${readingWords(q.name_ar)} — كل رواياتها`,
    books: [], readOption: { qiraa_id: Number(q.id) }, url: `/graph/quran/group-paths?qiraa_id=${q.id}`,
  }));
  quranOptions(conns, lists).forEach(([, opts]) => opts.forEach(o => out.push({
    key: o.key, kind: 'riwaya', qiraa_id: o.qiraa_id, riwaya_id: o.riwaya_id, tariq_id: o.tariq_id,
    label: readingWords(o.qiraaLabel, o.riwayaLabel, o.tariqLabel),
    name: [o.riwayaLabel || o.qiraaLabel, o.tariqLabel].filter(Boolean).join(' — '),
    books: [], readOption: o, url: `/graph/quran/paths?${quranPathParams(o)}`,
  })));
  return out;
}

/** Adds a choice to the picked keys: a whole qiraa replaces its riwayat; a riwaya under a picked whole qiraa is not added. */
export function addChoice(picked, key, choices) {
  const byKey = new Map(choices.map(c => [c.key, c]));
  const c = byKey.get(key);
  if (!c || picked.includes(key)) return picked;
  if (c.kind === 'riwaya' && picked.some(k => byKey.get(k)?.kind === 'whole' && byKey.get(k).qiraa_id === Number(c.qiraa_id))) return picked;
  const rest = c.kind === 'whole' ? picked.filter(k => !(byKey.get(k)?.kind === 'riwaya' && Number(byKey.get(k).qiraa_id) === c.qiraa_id)) : picked;
  return [...rest, key];
}

/** «برواية قالون عن نافع ورواية حفص عن عاصم»; withBooks: a group's books «بمضمن …» after it. */
export function choicesReading(picked, { withBooks = false } = {}) {
  const parts = picked.map(c => (withBooks && c.books?.length ? groupReading({ text: c.label, books: c.books }).slice(1) : c.label)).filter(Boolean);
  return parts.length ? `ب${parts.join(' و')}` : '';
}
