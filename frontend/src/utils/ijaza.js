// Ijaza templates: {placeholder} filling and the phrases that go into them.

export const PLACEHOLDERS = [
  { key: 'الطالب',          hint: 'اسم المجاز' },
  { key: 'كيفية_الأخذ',     hint: 'قرأ عليّ / سمع مني…' },
  { key: 'المتن',           hint: 'عنوان المتن' },
  { key: 'المؤلف',          hint: 'مؤلف المتن' },
  { key: 'ما_قرئ',          hint: 'برواية … من طريق …' },
  { key: 'القراءة',         hint: 'اسم القراءة' },
  { key: 'الرواية',         hint: 'اسم الرواية' },
  { key: 'الطريق',          hint: 'اسم الطريق' },
  { key: 'شيوخ_القراءة',    hint: 'فقرة الشيوخ الذين قرأت عليهم (إن كانوا أكثر من واحد)' },
  { key: 'الإسناد',         hint: 'نص الإسناد كاملاً' },
  { key: 'المجيز',          hint: 'اسمك' },
  { key: 'المكان',          hint: 'مكان الإجازة' },
  { key: 'التاريخ',         hint: 'التاريخ الميلادي' },
  { key: 'التاريخ_الهجري',  hint: 'التاريخ الهجري' },
];

const PLACEHOLDER_RE = /\{([^{}\n]{1,40})\}/g;

// {المجاز:فأجزته|فأجزتها} — masculine|feminine by the student (المجاز) or me (المجيز); same syntax as the backend
const GENDER_RE = /\{([^{}:|\n]{1,20}):([^{}|\n]*)\|([^{}|\n]*)\}/g;
export const applyGender = (text, genders = {}) =>
  String(text ?? '').replace(GENDER_RE, (whole, role, m, f) => (role in genders ? (genders[role] === 'F' ? f : m) : whole));

/**
 * Replace {key} with values[key]. Unknown or empty keys stay visible and are reported,
 * except `optional` keys, which simply disappear (with their now-empty paragraph).
 */
export function fillTemplate(template, values, { optional = [], genders = {} } = {}) {
  const missing = new Set();
  const skip = new Set(optional);
  const text = applyGender(template, genders).replace(PLACEHOLDER_RE, (whole, key) => {
    const k = key.trim();
    const v = values[k];
    if (v == null || String(v).trim() === '') {
      if (skip.has(k)) return '';
      missing.add(k); return whole;
    }
    return String(v);
  }).replace(/\n[ \t]*(\n[ \t]*){2,}/g, '\n\n').trim();
  return { text, missing: [...missing] };
}

/** «أ، وب، وج» */
export const joinArabic = items => items.map((x, i) => (i === 0 ? x : `و${x}`)).join('، ');

// connections where I read (قراءة) or presented (عرض) — the ones that count as «قرأتُ عليه».
// By transmission *kind* (from the API), never by type id: ids differ between databases.
const READ_KINDS = new Set(['qiraa', 'ard']);

const groupIdOf = g => Number(g?.group_id ?? g);

/**
 * Does a Quran connection cover the chosen option? A group option: the links read with that group.
 * Otherwise a link's groups count as their members; an unscoped (مطلق) connection covers all.
 */
function coversQuran(conn, opt, riwayaQiraa, groups = []) {
  if (opt.group_id) return (conn.groups || []).some(g => groupIdOf(g) === Number(opt.group_id));
  const byId = new Map(groups.map(g => [Number(g.id), g]));
  const items = [...(conn.items || []), ...(conn.groups || []).flatMap(g => byId.get(groupIdOf(g))?.items || [])];
  if ((!items.length && !conn.groups?.length) || (!opt.qiraa_id && !opt.riwaya_id)) return true;
  return items.some(it => {
    if (opt.riwaya_id && it.riwaya_id) return String(it.riwaya_id) === String(opt.riwaya_id);
    const q = it.qiraa_id || (it.riwaya_id && riwayaQiraa(it.riwaya_id));
    return !q || String(q) === String(opt.qiraa_id);
  });
}

/**
 * The shuyukh I read this matn / riwaya on, from my direct connections (one entry per shaykh).
 * module 'mutoon': { matnId }; module 'quran': { option, riwayaQiraa(id) → qiraa_id, groups (with items) }.
 */
export function readingTeachers(conns, module, { matnId, option, riwayaQiraa = () => null, groups = [], readOf = null } = {}) {
  const seen = new Map();
  const linksTo = new Map();   // each shaykh's links that count (for readOf)
  conns.forEach(c => {
    if (Number(c.from_person_id) !== 0 || !READ_KINDS.has(c.tx_kind)) return;
    if (module === 'mutoon' && String(c.matn_id) !== String(matnId)) return;
    if (module === 'quran' && (!option || !coversQuran(c, option, riwayaQiraa, groups))) return;
    if (module !== 'mutoon' && module !== 'quran') return;
    linksTo.set(c.to_person_id, [...(linksTo.get(c.to_person_id) || []), c]);
    const prev = seen.get(c.to_person_id);
    if (!prev || (!prev.reading_mode && c.reading_mode)) {
      seen.set(c.to_person_id, { id: c.to_person_id, name: c.to_name, gender: c.to_gender === 'F' ? 'F' : 'M', reading_mode: c.reading_mode || null });
    }
  });
  const out = [...seen.values()];
  // Quran: what I read on each of them («بالقراءات العشر الصغرى»), see readOnShaykh
  return readOf ? out.map(t => ({ ...t, read: readOf(linksTo.get(t.id)) || null })) : out;
}

/*
 * What was read on a Quran link, for this ijaza («قرأ بقراءة عاصم على فلان»): only what concerns the
 * ijaza's choice, in the link's own words — a group of the link holding the choice first
 * («بالقراءات العشر الصغرى»), else its items that do («بقراءة عاصم», «برواية حفص عن عاصم من طريق …»).
 * «عام» links, made-up steps and links naming nothing relevant: '' (plain «قرأ على»).
 * option: { group_id } | { qiraa_id, riwaya_id? }; lists: { qiraat, riwayat, turuq, groups } (groups with items).
 */
export function readOnLink(link, option, lists) {
  if (!option || !link || Number(link.is_general) || link.auto || link.munqati || link.group_stop) return '';
  const byId = rows => new Map((rows || []).map(r => [Number(r.id), r]));
  const Q = byId(lists.qiraat), R = byId(lists.riwayat), T = byId(lists.turuq), G = byId(lists.groups);
  const group = option.group_id ? G.get(Number(option.group_id)) : null;
  const optQiraa = Number(option.qiraa_id ?? R.get(Number(option.riwaya_id))?.qiraa_id) || null;
  // wanted: the members to name — the group's, or the one choice
  const wanted = group ? group.items || [] : [{ qiraa_id: optQiraa, riwaya_id: Number(option.riwaya_id) || null }];
  const qiraaOf = it => Number(it.qiraa_id) || Number(R.get(Number(it.riwaya_id))?.qiraa_id) || Number(R.get(Number(T.get(Number(it.tariq_id))?.riwaya_id))?.qiraa_id) || null;
  const riwayaOf = it => Number(it.riwaya_id) || Number(T.get(Number(it.tariq_id))?.riwaya_id) || null;
  const holds = (m, it) => (m.riwaya_id
    ? (riwayaOf(it) ? riwayaOf(it) === Number(m.riwaya_id) : qiraaOf(it) === Number(R.get(Number(m.riwaya_id))?.qiraa_id ?? m.qiraa_id))
    : qiraaOf(it) === Number(m.qiraa_id));

  for (const ref of link.groups || []) {
    const g = G.get(Number(ref.group_id ?? ref)) || ref;
    const gi = g.items || [];
    const ok = group ? Number(g.id ?? ref.group_id) === Number(group.id) || wanted.every(m => gi.some(x => holds(m, x) || holds(x, m)))
      : gi.some(x => wanted.some(m => holds(m, x) || (!x.riwaya_id && qiraaOf(x) === m.qiraa_id)));
    if (ok) return groupReading({ text: g.text_ar || g.name_ar });
  }
  const items = (link.items || []).filter(it => wanted.some(m => holds(m, it) || (!riwayaOf(it) && qiraaOf(it) === (Number(m.qiraa_id) || Number(R.get(Number(m.riwaya_id))?.qiraa_id)))));
  if (!items.length) return '';
  // a group ijaza: a link naming every member reads the group
  if (group && wanted.every(m => items.some(it => holds(m, it)))) return groupReading({ text: group.text_ar || group.name_ar });
  const phrase = it => readingWords(Q.get(qiraaOf(it))?.name_ar, R.get(riwayaOf(it))?.name_ar, T.get(Number(it.tariq_id))?.name_ar);
  const parts = [...new Set(items.map(phrase).filter(Boolean))];
  return parts.length ? `ب${parts.join(' و')}` : '';
}

/** What I read on a shaykh over my links to him: one holding a group first, else the first that names something. */
export function readOnShaykh(links, option, lists) {
  const reads = (links || []).map(l => readOnLink(l, option, lists)).filter(Boolean);
  const viaGroup = (links || []).find(l => (l.groups || []).length && readOnLink(l, option, lists) && !readOnLink({ ...l, groups: [] }, option, lists).length);
  return (viaGroup ? readOnLink(viaGroup, option, lists) : null) || reads[0] || '';
}

/**
 * Each link of the chains gets what was read on it (read_with); the same as the level below → «بها».
 * From a rawi or an imam upward the links stay plain («وهو قرأ على الإمام عاصم، وهو قرأ على السلمي»):
 * «برواية حفص عن عاصم» on عاصم's own link would be wrong. Rawis and imams come from lists.riwayat / qiraat.
 */
export function withReads(chains, option, lists) {
  const top = new Set([...(lists.riwayat || []).map(r => Number(r.rawi_id)), ...(lists.qiraat || []).map(q => Number(q.imam_id))].filter(Boolean));
  return chains.map(c => {
    let prev = '';
    let above = false;
    return c.map((e, i) => {
      above = above || top.has(Number(e.from_person_id));
      const read = above ? '' : readOnLink(e, option, lists);
      const out = read && i > 0 && read === prev ? 'بها' : read;
      prev = read;
      return out ? { ...e, read_with: out } : e;
    });
  });
}

const bare = (name, word) => String(name || '').replace(new RegExp(`^${word}\\s+`), '');

/** «رواية حفص عن عاصم من طريق عبيد», «قراءة عاصم» (no «ب»): names as stored, with or without their word. */
export function readingWords(qiraa, riwaya, tariq) {
  if (!riwaya) return qiraa ? withWord(qiraa, 'قراءة') : '';
  const imam = bare(qiraa, 'قراءة');
  const rw = withWord(riwaya, 'رواية');
  return `${rw}${imam && !rw.includes(' عن ') ? ` عن ${imam}` : ''}${tariq ? ` من ${withWord(tariq, 'طريق')}` : ''}`;
}

/**
 * Several choices in one ijaza: one paragraph per choice, «وإسنادي في رواية قالون عن نافع: …».
 * sections: [{ label, text }]; one section → its text alone (the template's «وإسنادي فيه: …» stays).
 */
export function isnadSections(sections) {
  const list = sections.filter(x => x.text);
  if (sections.length <= 1) return list[0]?.text || '';
  return list.map(x => `وإسنادي في ${x.label}: ${x.text}`).join('.\n\n');
}

/**
 * Several paragraphs: a later chain that reaches a shaykh already written before, with at least two
 * more links the same above him, stops there with «بإسناده المتقدم» (the whole rest the same), or
 * «بإسناده المتقدم إلى ابن الجزري، وهو قرأ على …» and goes on where it parts.
 * sections: [{ chains }] in order → the same with the chains shortened by a refer step
 * ({ refer: true, note }) that the renderer writes after the shaykh's name.
 */
export function referEarlier(sections, minShared = 2) {
  const earlier = [];   // person-id sequences already written
  const ids = c => c.map(e => Number(e.to_person_id));
  return sections.map(sec => {
    const chains = sec.chains.map(c => {
      if (!earlier.length) return c;
      const to = ids(c);
      for (let i = 0; i < to.length - minShared; i++) {
        let best = 0;
        earlier.forEach(E => E.forEach((p, j) => {
          if (p !== to[i]) return;
          let n = 0;
          while (i + n + 1 < to.length && j + n + 1 < E.length && to[i + n + 1] === E[j + n + 1]) n++;
          best = Math.max(best, n);
        }));
        if (best < minShared) continue;
        const her = c[i].to_gender === 'F' ? 'بإسنادها' : 'بإسناده';
        const whole = i + best === to.length - 1;
        const upTo = c[i + best];
        const refer = { from_person_id: c[i].to_person_id, to_person_id: c[i].to_person_id, refer: true, items: [],
          note: whole ? `${her} المتقدم` : `${her} المتقدم إلى ${upTo.to_name}` };
        return [...c.slice(0, i + 1), refer, ...c.slice(i + best + 1)];
      }
      return c;
    });
    sec.chains.forEach(c => earlier.push(ids(c)));
    return { ...sec, chains };
  });
}

/** With several choices the paragraphs say «وإسنادي في …» themselves: drop the template's «وإسنادي فيه:». */
export const multiIsnadTemplate = tpl => String(tpl).replace(/وإسنادي\s+فيه\s*:\s*\{الإسناد\}/, '{الإسناد}');

/**
 * The teachers paragraph, or '' when fewer than two shuyukh (then it is left out).
 * «منهم: الشيخ أ غيباً من حفظي، والشيخة ب»
 * titles: { M, F } (a plain string is used for both).
 */
export function teachersParagraph(teachers, sentence, words = {}, titles = { M: 'الشيخ', F: 'الشيخة' }) {
  if (teachers.length < 2 || !sentence) return '';
  const t2 = typeof titles === 'string' ? { M: titles, F: titles } : titles;
  const items = teachers.map(t => {
    const mode = { heart: words.heart, looking: words.looking }[t.reading_mode];
    const title = t2[t.gender === 'F' ? 'F' : 'M'];
    const name = `${title ? `${title} ${t.name}` : t.name}${t.read ? ` ${t.read}` : ''}`;
    return mode ? `${name} ${mode}` : name;
  });
  return sentence.replace('{الشيوخ}', joinArabic(items));
}

// how the student received, by transmission kind — [masculine, feminine]
const TAKHAMMUL = {
  lafz: ['سمع من لفظي', 'سمعت من لفظي'], sama: ['سمع مني', 'سمعت مني'], qiraa: ['قرأ عليّ', 'قرأت عليّ'],
  ard: ['عرض عليّ', 'عرضت عليّ'], sama_reading: ['سمع مني بقراءة غيره', 'سمعت مني بقراءة غيرها'],
  ijaza: ['استجازني في', 'استجازتني في'], ijaza_general: ['استجازني في', 'استجازتني في'],
  munawala: ['ناولته', 'ناولتها'], kitaba: ['كتبت إليه', 'كتبت إليها'],
};
export const takhammulPhrase = (kind, gender = 'M') => (TAKHAMMUL[kind] || TAKHAMMUL.qiraa)[gender === 'F' ? 1 : 0];

const withWord = (name, word) => (name.startsWith(word) ? name : `${word} ${name}`);

/** «برواية ورش عن نافع من طريق الأزرق» — empty when nothing is specified (مطلق). */
export function readingPhrase({ qiraa, riwaya, tariq } = {}) {
  const parts = [];
  if (riwaya) parts.push(`ب${withWord(riwaya, 'رواية')}`);
  else if (qiraa) parts.push(`ب${withWord(qiraa, 'قراءة')}`);
  if (tariq) parts.push(`من ${withWord(tariq, 'طريق')}`);
  return parts.join(' ');
}

/** A group's isnad after the meeting point (ابن الجزري…); the default is in the ijaza settings. */
export const GROUP_MODES = [
  { value: 'stop', label: 'التوقف عند ابن الجزري («وإسناده موجود في كتابه النشر»)' },
  { value: 'all', label: 'إسناد كل إمام (مع التحويل ح)' },
  { value: 'riwaya', label: 'إسناد رواية واحدة' },
];

/** A group read: «بالقراءات العشر الصغرى بمضمن الشاطبية والدرة» (books optional). */
export function groupReading({ text, books = [] } = {}) {
  if (!text) return '';
  const titles = books.map(b => b.title ?? b).filter(Boolean);
  return `ب${text}${titles.length ? ` بمضمن ${titles.join(' و')}` : ''}`;
}

/** ISO date (YYYY-MM-DD) → { gregorian, hijri } in Arabic with Latin digits. */
export function formatDates(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { gregorian: '', hijri: '' };
  const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  const fmt = (locale, extra = '') => {
    try { return new Intl.DateTimeFormat(locale, opts).format(d) + extra; } catch { return ''; }
  };
  return {
    gregorian: fmt('ar-MA-u-nu-latn', 'م'),
    hijri: fmt('ar-SA-u-ca-islamic-umalqura-nu-latn').replace(/\s*هـ$/, '') + 'هـ',
  };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Title line of the certificate. */
export function ijazaTitle(module, { matn, reading } = {}) {
  if (module === 'mutoon') return matn ? `إجازة في متن «${matn}»` : 'إجازة';
  if (module === 'quran') return `إجازة في القرآن الكريم${reading ? ` ${reading}` : ''}`;
  return 'إجازة عامة';
}

// placeholders a title may use (filled from the same values as the body)
export const TITLE_PLACEHOLDERS = [
  { key: 'المتن', hint: 'عنوان المتن' }, { key: 'المؤلف', hint: 'مؤلف المتن' },
  { key: 'القراءة_والرواية', hint: 'برواية … من طريق … (فارغ إن لم تُحدَّد)' },
  { key: 'القراءة', hint: 'اسم القراءة' }, { key: 'الرواية', hint: 'اسم الرواية' }, { key: 'الطريق', hint: 'اسم الطريق' },
  { key: 'الطالب', hint: 'اسم المجاز' },
];

/**
 * The title from the type's title template. Optional parts (القراءة_والرواية) vanish when empty;
 * while something required is not chosen yet (no matn), the built-in title stands in.
 */
export function titleFromTemplate(tpl, module, values) {
  const fallback = ijazaTitle(module, { matn: values['المتن'], reading: values['القراءة_والرواية'] });
  if (!tpl?.text) return fallback;
  const f = fillTemplate(tpl.text, values, { optional: ['القراءة_والرواية'] });
  // line breaks are kept (a long matn name on its own line); spaces inside a line are tidied
  return f.missing.length ? fallback : f.text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** A design with the title's own colour / font / size applied (empty values keep the design's). */
export function withTitleStyle(design, st = {}) {
  return {
    ...design,
    colors: { ...design.colors, ...(st.color ? { title: st.color } : {}) },
    fonts: { ...design.fonts, title: { family: st.family || design.fonts.title.family, size: Number(st.size) || design.fonts.title.size } },
  };
}

/* ── my teachers' order (per matn / riwaya), used by the teachers paragraph and the routes ── */

/** Storage key of the order: «m:<matnId>» / «q:<quran option key>», or null when nothing is chosen. */
export const teacherOrderKey = (module, { matnId, quranKey } = {}) =>
  (module === 'mutoon' && matnId ? `m:${matnId}` : module === 'quran' && quranKey ? `q:${quranKey}` : null);

/** Items with an `id`, sorted by their place in `ids`; those not in it keep their order, after the rest. */
export function sortByOrder(items, ids = [], idOf = x => x.id) {
  const pos = new Map((ids || []).map((id, i) => [String(id), i]));
  return items
    .map((x, i) => ({ x, i, p: pos.has(String(idOf(x))) ? pos.get(String(idOf(x))) : Infinity }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map(o => o.x);
}

/**
 * Everyone I can order for this ijaza: the first shaykh of each route, and the shuyukh I read on
 * (the teachers paragraph), once each, in the saved order.
 * → [{ id, name, routes: [group index], reads: bool }]
 */
export function orderablePeople(groups, teachers, ids) {
  const byId = new Map();
  groups.forEach((g, gi) => {
    const id = Number(g.firstEdge.to_person_id);
    if (!byId.has(id)) byId.set(id, { id, name: g.firstEdge.to_name, routes: [], reads: false });
    byId.get(id).routes.push(gi);
  });
  teachers.forEach(t => {
    const id = Number(t.id);
    if (!byId.has(id)) byId.set(id, { id, name: t.name, routes: [], reads: false });
    byId.get(id).reads = true;
  });
  return sortByOrder([...byId.values()], ids);
}

/** Move the item at index i by dir (−1 up / +1 down); returns the new list of ids. */
export function moveId(list, i, dir) {
  const ids = list.map(x => x.id);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return ids;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}
