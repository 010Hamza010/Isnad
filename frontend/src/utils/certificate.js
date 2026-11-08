/**
 * Certificate text → atoms for colouring and pagination.
 * Atoms are the smallest units a page may break between; a name is never split.
 *   { type: 'word', text }            plain word
 * Every atom also has `space`: true when followed by whitespace.
 *   { type: 'role', role, text }      student | shaykh | name | sacred | death
 *   { type: 'tahwil' }                «ح»
 *   { type: 'note', id }              footnote reference [[id]] (attached to the previous atom)
 *   { type: 'placeholder', text }     unfilled {key}
 */

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build the role matcher once per certificate. names: { student, shaykh, names[], sacred[] } */
export function roleMatcher({ student, shaykh, names = [], sacred = [] } = {}) {
  const entries = [];
  const add = (text, role) => { const t = String(text ?? '').trim(); if (t.length > 1) entries.push({ text: t, role }); };
  add(student, 'student');
  add(shaykh, 'shaykh');
  sacred.forEach(n => add(n, 'sacred'));
  names.forEach(n => add(n, 'name'));
  // longest first so «محمد بن جعفر الكتاني» wins over «جعفر الكتاني»; first role wins on duplicates
  const byText = new Map();
  entries.forEach(e => { if (!byText.has(e.text)) byText.set(e.text, e.role); });
  const sorted = [...byText.keys()].sort((a, b) => b.length - a.length);
  const parts = ['\\(ت [^()]{1,30}\\)', ...sorted.map(escape)];
  return { re: new RegExp(`(${parts.join('|')})`, 'g'), roleOf: t => (t.startsWith('(ت ') ? 'death' : byText.get(t)) };
}

const SPECIAL = /(\[\[-?\d+\]\]|\{[^{}\n]{1,40}\}|(?<=^|\s)ح(?=\s|$))/g;

/** One paragraph → atoms. */
export function toAtoms(paragraph, matcher) {
  const atoms = [];
  const pushWords = text => text.split(/\s+/).forEach(w => { if (w) atoms.push({ type: 'word', text: w }); });

  String(paragraph).split(SPECIAL).forEach(part => {
    if (!part) return;
    if (part === 'ح') { atoms.push({ type: 'tahwil' }); return; }
    const note = part.match(/^\[\[(-?\d+)\]\]$/);
    if (note) { atoms.push({ type: 'note', id: Number(note[1]) }); return; }
    if (/^\{.*\}$/.test(part)) { atoms.push({ type: 'placeholder', text: part }); return; }
    if (!matcher) { pushWords(part); return; }
    part.split(matcher.re).forEach((seg, i) => {
      if (!seg) return;
      if (i % 2 === 1) atoms.push({ type: 'role', role: matcher.roleOf(seg), text: seg });
      else pushWords(seg);
    });
  });

  return markSpaces(paragraph, atoms);
}

// `space`: whether the atom is followed by whitespace in the source, so rendering restores spacing
// exactly («النبي ﷺ،» stays tight).
function markSpaces(src, atoms) {
  let pos = 0;
  const text = String(src);
  const lenOf = a => (a.type === 'tahwil' ? 1 : a.type === 'note' ? `[[${a.id}]]`.length : a.text.length);
  atoms.forEach(a => {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    pos += lenOf(a);
    a.space = pos < text.length && /\s/.test(text[pos]);
  });
  return atoms;
}

/** Paragraphs of the body (blank-line separated) as atom lists. */
export const bodyToParagraphs = (body, matcher) =>
  String(body ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => toAtoms(p, matcher));

/** Footnote numbers in reading order, for ids that have a note. */
export function numberNotes(paragraphs, notes) {
  const numbers = new Map();
  paragraphs.forEach(atoms => atoms.forEach(a => {
    if (a.type === 'note' && notes[a.id] && !numbers.has(a.id)) numbers.set(a.id, numbers.size + 1);
  }));
  return numbers;
}

/** Names for colouring, taken from the isnad chains. */
export function chainNames(chains) {
  const names = new Set(), sacred = new Set();
  (chains || []).forEach(c => c.forEach(e => {
    [[e.from_person_id, e.from_name], [e.to_person_id, e.to_name]].forEach(([id, n]) => {
      if (!n || Number(id) === 0) return;
      (Number(id) < 0 ? sacred : names).add(n);
    });
  }));
  return { names: [...names], sacred: [...sacred] };
}

/** Design → CSS custom properties on the certificate root. */
export function designVars(design) {
  const v = {};
  Object.entries(design.colors).forEach(([k, c]) => { v[`--c-${k}`] = c; });
  Object.entries(design.fonts).forEach(([k, f]) => {
    v[`--f-${k}`] = `"${f.family}", "Amiri", serif`;
    v[`--s-${k}`] = `${f.size}pt`;
  });
  v['--page-margin'] = `${design.frame.marginMm}mm`;
  v['--page-pad'] = `${design.frame.paddingMm}mm`;
  v['--names-weight'] = design.boldNames ? 700 : 'inherit';
  return v;
}
