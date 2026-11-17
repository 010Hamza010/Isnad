// «إسناد علَم»: the page's choices live in the URL (?from=&kind=person|matn|quran&to=&module=&matn=&q=)
// so a link from the persons page or the graph opens it ready. q: «r<id>» a riwaya, «q<id>» a whole qiraa.

export const KINDS = ['person', 'matn', 'quran'];

/** URL params → the choices, with defaults. */
export function betweenChoice(params) {
  const get = k => params.get(k) || '';
  const kind = KINDS.includes(get('kind')) ? get('kind') : 'matn';
  return { from: get('from') || '0', kind, to: get('to'), module: get('module') === 'quran' ? 'quran' : 'mutoon', matn: get('matn'), q: get('q') };
}

/** The choices → the API query string, or null while something is missing. */
export function betweenQuery(c) {
  const p = new URLSearchParams({ from: c.from || '0' });
  if (c.kind === 'person') {
    if (!c.to || String(c.to) === String(c.from || '0')) return null;
    p.set('to', c.to);
    if (c.module === 'quran') p.set('module', 'quran');
  } else if (c.kind === 'matn') {
    if (!c.matn) return null;
    p.set('matn_id', c.matn);
  } else {
    const m = /^([rq])(\d+)$/.exec(c.q || '');
    if (!m) return null;
    p.set(m[1] === 'r' ? 'riwaya_id' : 'qiraa_id', m[2]);
  }
  return p.toString();
}

/** Quran choices for the picker: each riwaya, then each whole qiraa. */
export const quranChoices = (riwayat = [], qiraat = []) => [
  ...riwayat.map(r => ({ value: `r${r.id}`, label: r.name_ar, sub: r.qiraa_name || undefined })),
  ...qiraat.map(q => ({ value: `q${q.id}`, label: q.name_ar, sub: 'القراءة كلها' })),
];
