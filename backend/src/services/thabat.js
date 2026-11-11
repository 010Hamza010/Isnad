/**
 * «ثبتي»: my whole network of connections (mutoon and Quran) as one file another instance can
 * merge into its own. Like the single-isnad share (services/shareIsnad) it names people, mutoon
 * and qiraat / riwayat / turuq — never ids:
 *   { format: 'isnad-thabat', version: 1, exported_at, from,
 *     persons: { me|p<id>: {…} }, mutoon: { m<id>: { title, author, subject, description } },
 *     qiraat: { q<id>: { name_ar, imam } }, riwayat: { r<id>: { name_ar, qiraa, rawi } },
 *     turuq: { t<id>: { name_ar, riwaya, parent } },
 *     groups: { g<id>: { name_ar, text_ar, description, items: [{ qiraa, riwaya }], books: [m<id>] } },   (v2)
 *     links: [{ from, to, matn|null, tx_kind, reading_mode, description }],          null matn = «عام»
 *     quran: [{ from, to, tx_kind, reading_mode, description, ijaza_date, khatmat_count, meeting_mode, items: [{ qiraa, riwaya, tariq }],
 *               is_general, books: [m<id>], groups: [g<id>] }] }                     (the last three: v2)
 * Books (الشاطبية…) are mutoon of the file; a group is matched here by its name, else created.
 * Persons -1…-3 (النبي ﷺ، جبريل، رب العزة) are fixed everywhere: refs s1…s3, never reviewed.
 * Import never edits what the receiver wrote: existing connections are skipped, a matched
 * person only gets the fields that are empty here.
 */
const { HttpError } = require('../utils/httpError');
const { normalizeArabic } = require('./isnadText/normalize');
const { resolvePerson } = require('./shareIsnad');
const { pickType } = require('./isnadImport');
const { QURAN_KIND } = require('./quranReading');

const FORMAT = 'isnad-thabat';
const VERSION = 2;   // 2: Quran books, groups and «عام»
const ME = 'me';
const REF_RE = /^[\w-]{1,40}$/;
const UID_RE = /^[0-9a-zA-Z-]{8,36}$/;
const MODES = new Set(['heart', 'looking']);
const MEETING = new Set(['حضوراً', 'عن بُعد', 'مختلط']);
const FILL = ['description', 'death_year', 'kunya', 'nisba', 'region', 'name_latin', 'century'];
const MAX = { persons: 20000, links: 50000, quran: 20000, mutoon: 5000, refs: 2000 };

const pref = id => (Number(id) === 0 ? ME : Number(id) < 0 ? `s${-Number(id)}` : `p${Number(id)}`);
const sacredId = ref => (/^s[123]$/.test(ref) ? -Number(ref.slice(1)) : null);
const str = (v, max) => (v == null || v === '' ? null : String(v).slice(0, max));
const norm = s => normalizeArabic(s || '');
const groupId = g => Number(g?.group_id ?? g);

/* ───────────── export ───────────── */

/** Which connections go in the file, and the person ids they need (to give them codes first). */
function selection(data, { mutoon = true, quran = true } = {}) {
  const pick = mutoon === true ? () => true : Array.isArray(mutoon) ? c => c.matn_id == null || Number(c.is_general_ijaza) === 1 || mutoon.map(Number).includes(Number(c.matn_id)) : () => false;
  const links = data.matnConns.filter(pick);
  const qlinks = quran ? data.quranConns : [];
  const ids = new Set();
  [...links, ...qlinks].forEach(c => { ids.add(Number(c.from_person_id)); ids.add(Number(c.to_person_id)); });
  const matnIds = new Set(links.filter(c => c.matn_id != null && !Number(c.is_general_ijaza)).map(c => Number(c.matn_id)));
  // books read «بمضمنها» on a Quran link, or with a group it was read with
  const groupIds = new Set(qlinks.flatMap(c => (c.groups || []).map(groupId)));
  const groups = (data.groups || []).filter(g => groupIds.has(Number(g.id)));
  [...qlinks.flatMap(c => c.books || []), ...groups.flatMap(g => g.books || [])].forEach(b => matnIds.add(Number(b.matn_id ?? b)));
  data.mutoon.filter(m => matnIds.has(Number(m.id)) && m.author_id != null).forEach(m => ids.add(Number(m.author_id)));
  if (qlinks.length) {
    data.qiraat.forEach(q => q.imam_id != null && ids.add(Number(q.imam_id)));
    data.riwayat.forEach(r => r.rawi_id != null && ids.add(Number(r.rawi_id)));
  }
  return { links, qlinks, groups, matnIds, personIds: [...ids].filter(id => id > 0) };
}

/**
 * data: { persons: Map id → row (with uid), mutoon, matnConns, quranConns (with items), qiraat, riwayat, turuq }
 * opts: { mutoon: true | [ids] | false, quran: bool, bios: bool }; sender: { name_ar, uid, gender }.
 */
function buildThabat(data, opts, sender, now = new Date()) {
  const { links, qlinks, groups: usedGroups, matnIds, personIds } = selection(data, opts);
  const persons = { [ME]: { uid: sender.uid || null, name_ar: sender.name_ar, gender: sender.gender === 'F' ? 'F' : 'M' } };
  personIds.forEach(id => {
    const p = data.persons.get(id);
    if (!p) return;
    persons[pref(id)] = {
      uid: p.uid || null, name_ar: p.name_ar, name_latin: p.name_latin || null, kunya: p.kunya || null, nisba: p.nisba || null,
      death_year: p.death_year || null, century: p.century ?? null, gender: p.gender === 'F' ? 'F' : 'M', region: p.region || null,
      ...(opts.bios && p.description ? { description: p.description } : {}),
    };
  });
  const known = ref => (ref === ME || sacredId(ref) != null || persons[ref] ? ref : null);

  const mutoon = {};
  data.mutoon.filter(m => matnIds.has(Number(m.id))).forEach(m => {
    mutoon[`m${m.id}`] = { title: m.title, author: m.author_id == null ? null : known(pref(m.author_id)), subject: m.subject || null, description: m.description || null };
  });

  const qiraat = {}, riwayat = {}, turuq = {};
  if (qlinks.length) {
    const usedT = new Set(), usedR = new Set(), usedQ = new Set();
    const tById = new Map(data.turuq.map(t => [Number(t.id), t]));
    const rById = new Map(data.riwayat.map(r => [Number(r.id), r]));
    qlinks.forEach(c => (c.items || []).forEach(it => {
      for (let t = it.tariq_id && tById.get(Number(it.tariq_id)); t; t = t.parent_id && tById.get(Number(t.parent_id))) {
        usedT.add(Number(t.id)); if (t.riwaya_id) usedR.add(Number(t.riwaya_id));
      }
      if (it.riwaya_id) usedR.add(Number(it.riwaya_id));
      if (it.qiraa_id) usedQ.add(Number(it.qiraa_id));
    }));
    usedGroups.forEach(g => (g.items || []).forEach(it => {
      if (it.riwaya_id) usedR.add(Number(it.riwaya_id)); else if (it.qiraa_id) usedQ.add(Number(it.qiraa_id));
    }));
    usedR.forEach(id => { const r = rById.get(id); if (r?.qiraa_id) usedQ.add(Number(r.qiraa_id)); });
    data.qiraat.filter(q => usedQ.has(Number(q.id))).forEach(q => { qiraat[`q${q.id}`] = { name_ar: q.name_ar, imam: q.imam_id == null ? null : known(pref(q.imam_id)) }; });
    data.riwayat.filter(r => usedR.has(Number(r.id))).forEach(r => { riwayat[`r${r.id}`] = { name_ar: r.name_ar, qiraa: `q${r.qiraa_id}`, rawi: r.rawi_id == null ? null : known(pref(r.rawi_id)) }; });
    data.turuq.filter(t => usedT.has(Number(t.id))).forEach(t => { turuq[`t${t.id}`] = { name_ar: t.name_ar, riwaya: t.riwaya_id ? `r${t.riwaya_id}` : null, parent: t.parent_id ? `t${t.parent_id}` : null }; });
  }
  const groups = {};
  usedGroups.forEach(g => {
    groups[`g${g.id}`] = {
      name_ar: g.name_ar, text_ar: g.text_ar || null, description: g.description || null,
      items: (g.items || []).map(it => (it.riwaya_id ? { qiraa: null, riwaya: `r${it.riwaya_id}` } : { qiraa: `q${it.qiraa_id}`, riwaya: null })),
      books: (g.books || []).map(b => `m${b.matn_id ?? b}`),
    };
  });

  return {
    format: FORMAT, version: VERSION, exported_at: now.toISOString(), from: sender.name_ar,
    persons, mutoon, qiraat, riwayat, turuq, groups,
    links: links.map(c => ({
      from: pref(c.from_person_id), to: pref(c.to_person_id),
      matn: c.matn_id == null || Number(c.is_general_ijaza) ? null : `m${c.matn_id}`,
      tx_kind: c.tx_kind || null, reading_mode: c.reading_mode || null, description: c.description || null,
    })),
    quran: qlinks.map(c => ({
      from: pref(c.from_person_id), to: pref(c.to_person_id), tx_kind: c.tx_kind || null, reading_mode: c.reading_mode || null,
      description: c.description || null, ijaza_date: c.ijaza_date || null, khatmat_count: c.khatmat_count ?? null, meeting_mode: c.meeting_mode || null,
      items: (c.items || []).map(it => ({ qiraa: it.qiraa_id ? `q${it.qiraa_id}` : null, riwaya: it.riwaya_id ? `r${it.riwaya_id}` : null, tariq: it.tariq_id ? `t${it.tariq_id}` : null })),
      is_general: !!Number(c.is_general),
      books: (c.books || []).map(b => `m${b.matn_id ?? b}`),
      groups: (c.groups || []).map(g => `g${groupId(g)}`),
    })),
  };
}

/* ───────────── import ───────────── */

function validateThabat(file) {
  if (!file || file.format !== FORMAT || typeof file.persons !== 'object') throw new HttpError(400, 'هذا الملف ليس ثبتاً مُصدَّراً من «إسناد»');
  if (Number(file.version) > VERSION) throw new HttpError(400, 'الملف من إصدار أحدث — حدّث البرنامج أولاً');
  const obj = (k, max) => {
    const o = file[k] || {};
    if (typeof o !== 'object' || Array.isArray(o) || Object.keys(o).length > max) throw new HttpError(400, `قسم «${k}» غير صالح`);
    Object.keys(o).forEach(r => { if (!REF_RE.test(r)) throw new HttpError(400, `مرجع غير صالح: ${r}`); });
    return o;
  };
  const rawP = obj('persons', MAX.persons);
  if (!rawP[ME]) throw new HttpError(400, 'الملف لا يذكر المُرسِل');

  const persons = {};
  Object.entries(rawP).forEach(([ref, p]) => {
    const name = String(p?.name_ar ?? '').trim();
    if (!name || name.length > 200) throw new HttpError(400, `علَم بلا اسم في الملف (${ref})`);
    persons[ref] = {
      uid: UID_RE.test(String(p.uid ?? '')) ? String(p.uid) : null, name_ar: name,
      name_latin: str(p.name_latin, 200), kunya: str(p.kunya, 100), nisba: str(p.nisba, 150), death_year: str(p.death_year, 20),
      century: Number.isInteger(Number(p.century)) && p.century != null ? Number(p.century) : null,
      gender: p.gender === 'F' ? 'F' : 'M', region: str(p.region, 150), description: str(p.description, 20000),
    };
  });
  const person = (ref, where, nullable = false) => {
    if (ref == null && nullable) return null;
    if (sacredId(ref) != null || persons[ref]) return ref;
    throw new HttpError(400, `${where}: علَم غير موجود في الملف`);
  };

  const mutoon = {};
  Object.entries(obj('mutoon', MAX.mutoon)).forEach(([ref, m]) => {
    const title = String(m?.title ?? '').trim();
    if (!title) throw new HttpError(400, `متن بلا عنوان (${ref})`);
    mutoon[ref] = { title: title.slice(0, 300), author: person(m.author, `مؤلف «${title}»`, true), subject: str(m.subject, 100), description: str(m.description, 20000) };
  });
  const named = (o, k) => { const n = String(o?.name_ar ?? '').trim(); if (!n) throw new HttpError(400, `اسم ناقص في «${k}»`); return n.slice(0, 150); };
  const qiraat = {}, riwayat = {}, turuq = {};
  Object.entries(obj('qiraat', MAX.refs)).forEach(([ref, q]) => { qiraat[ref] = { name_ar: named(q, 'القراءات'), imam: person(q.imam, 'إمام قراءة', true) }; });
  Object.entries(obj('riwayat', MAX.refs)).forEach(([ref, r]) => {
    if (!qiraat[r?.qiraa]) throw new HttpError(400, `رواية بلا قراءة (${ref})`);
    riwayat[ref] = { name_ar: named(r, 'الروايات'), qiraa: r.qiraa, rawi: person(r.rawi, 'راوٍ', true) };
  });
  const rawT = obj('turuq', MAX.refs);
  Object.entries(rawT).forEach(([ref, t]) => {
    if (t?.riwaya != null && !riwayat[t.riwaya]) throw new HttpError(400, `طريق لرواية غير موجودة (${ref})`);
    if (t?.parent != null && !rawT[t.parent]) throw new HttpError(400, `طريق فرعي لأصل غير موجود (${ref})`);
    turuq[ref] = { name_ar: named(t, 'الطرق'), riwaya: t.riwaya ?? null, parent: t.parent ?? null };
  });

  const refsIn = (list, known, where) => (Array.isArray(list) ? list : []).slice(0, 50).map(r => {
    if (!known[r]) throw new HttpError(400, `${where}: مرجع غير موجود في الملف`);
    return r;
  });
  const groups = {};
  Object.entries(obj('groups', MAX.refs)).forEach(([ref, g]) => {
    const where = `مجموعة «${String(g?.name_ar ?? ref)}»`;
    const items = (Array.isArray(g?.items) ? g.items : []).slice(0, 100).map(it => {
      const q = it?.riwaya ? null : it?.qiraa ?? null, r = it?.riwaya ?? null;
      if ((q && !qiraat[q]) || (r && !riwayat[r]) || (!q && !r)) throw new HttpError(400, `${where}: قراءة أو رواية غير موجودة في الملف`);
      return { qiraa: q, riwaya: r };
    });
    if (!items.length) throw new HttpError(400, `${where}: بلا قراءات`);
    groups[ref] = { name_ar: named(g, 'المجموعات'), text_ar: str(g.text_ar, 255), description: str(g.description, 5000), items, books: refsIn(g.books, mutoon, where) };
  });

  const arr = (k, max) => { const a = file[k] || []; if (!Array.isArray(a) || a.length > max) throw new HttpError(400, `قسم «${k}» غير صالح`); return a; };
  const base = (c, i, k) => {
    const where = `${k === 'links' ? 'اتصال' : 'اتصال قرآن'} ${i + 1}`;
    const from = person(c?.from, where), to = person(c?.to, where);
    if (to === ME) throw new HttpError(400, `${where}: لا اتصال إلى المُرسِل نفسه`);
    if (from === to) throw new HttpError(400, `${where}: علَم متصل بنفسه`);
    return { from, to, tx_kind: str(c.tx_kind, 30), reading_mode: MODES.has(c.reading_mode) ? c.reading_mode : null, description: str(c.description, 5000) };
  };
  const links = arr('links', MAX.links).map((c, i) => {
    if (c.matn != null && !mutoon[c.matn]) throw new HttpError(400, `اتصال ${i + 1}: متن غير موجود في الملف`);
    return { ...base(c, i, 'links'), matn: c.matn ?? null };
  });
  const quran = arr('quran', MAX.quran).map((c, i) => ({
    ...base(c, i, 'quran'),
    ijaza_date: str(c.ijaza_date, 20), khatmat_count: Number.isInteger(c.khatmat_count) ? c.khatmat_count : null,
    meeting_mode: MEETING.has(c.meeting_mode) ? c.meeting_mode : null,
    items: (Array.isArray(c.items) ? c.items : []).slice(0, 50).map(it => {
      const q = it?.qiraa ?? null, r = it?.riwaya ?? null, t = it?.tariq ?? null;
      if ((q && !qiraat[q]) || (r && !riwayat[r]) || (t && !turuq[t])) throw new HttpError(400, `اتصال قرآن ${i + 1}: قراءة أو رواية أو طريق غير موجود في الملف`);
      return { qiraa: q, riwaya: r, tariq: t };
    }),
    // v1 files have none of these: «عام» is then guessed on import (a link above mine naming nothing)
    is_general: typeof c.is_general === 'boolean' || c.is_general === 0 || c.is_general === 1 ? !!c.is_general : null,
    books: refsIn(c.books, mutoon, `اتصال قرآن ${i + 1}`),
    groups: refsIn(c.groups, groups, `اتصال قرآن ${i + 1}`),
  }));

  return { format: FORMAT, version: VERSION, exported_at: str(file.exported_at, 40), from: str(file.from, 200), persons, mutoon, qiraat, riwayat, turuq, groups, links, quran };
}

/** The file's qiraat / riwayat / turuq → local ids by name (null = created on import). */
function mapQuran(file, local) {
  const map = {};
  const find = (list, name, ok = () => true) => list.find(x => norm(x.name_ar) === norm(name) && ok(x))?.id ?? null;
  Object.entries(file.qiraat).forEach(([ref, q]) => { map[ref] = find(local.qiraat, q.name_ar); });
  Object.entries(file.riwayat).forEach(([ref, r]) => {
    const qid = map[r.qiraa];
    map[ref] = qid == null ? null : find(local.riwayat, r.name_ar, x => Number(x.qiraa_id) === Number(qid));
  });
  // a tariq is the same when its name and its riwaya are
  Object.entries(file.turuq).forEach(([ref, t]) => {
    const rid = t.riwaya ? map[t.riwaya] : null;
    map[ref] = t.riwaya && rid == null ? null : find(local.turuq, t.name_ar, x => (x.riwaya_id == null ? null : Number(x.riwaya_id)) === (rid == null ? null : Number(rid)));
  });
  // a group is the same when its name is
  Object.entries(file.groups || {}).forEach(([ref, g]) => { map[ref] = find(local.groups || [], g.name_ar); });
  return map;
}

/** Local mutoon with the same title: one → matched, several → ambiguous, none → new. */
function resolveMatn(m, localMutoon) {
  const hits = localMutoon.filter(x => norm(x.title) === norm(m.title));
  if (hits.length === 1) return { status: 'matched', matn_id: hits[0].id, candidates: hits };
  return { status: hits.length ? 'ambiguous' : 'new', matn_id: null, candidates: hits.map(h => ({ id: h.id, title: h.title })) };
}

/**
 * ctx: { byUid, index, personsById, local: { mutoon, qiraat, riwayat, turuq } }
 * → persons / mutoon rows to review, the Quran names and whether they exist here, counts.
 */
function previewThabat(file, ctx) {
  const persons = Object.entries(file.persons).map(([ref, p]) => ({
    ref, name_ar: p.name_ar, death_year: p.death_year, kunya: p.kunya, nisba: p.nisba, role: ref === ME ? 'sender' : null,
    ...resolvePerson(p, ctx),
  }));
  const mutoon = Object.entries(file.mutoon).map(([ref, m]) => ({ ref, title: m.title, author: m.author ? file.persons[m.author]?.name_ar ?? null : null, ...resolveMatn(m, ctx.local.mutoon) }));
  const qmap = mapQuran(file, ctx.local);
  const quranNames = ['qiraat', 'riwayat', 'turuq', 'groups'].flatMap(k => Object.entries(file[k] || {}).map(([ref, x]) => ({ ref, kind: k, name_ar: x.name_ar, local_id: qmap[ref] })));
  return {
    persons, mutoon, quranNames,
    counts: { persons: persons.length, mutoon: mutoon.length, links: file.links.length, quran: file.quran.length },
  };
}

/**
 * Picks → everything to write.
 * picks: { persons: { ref: id|'new' }, mutoon: { ref: id|'new' } }
 * ctx: { byUid, types, qmap, personsById, existingMatn: Set «from:to:matn|g», existingQuran: Set «from:to:items-signature» }
 */
function planThabat(file, picks, ctx) {
  const pp = picks?.persons || {}, mp = picks?.mutoon || {};
  const leftP = Object.keys(file.persons).filter(r => pp[r] == null || pp[r] === '');
  if (leftP.length) throw new HttpError(400, `حدّد الأعلام: ${leftP.slice(0, 5).map(r => file.persons[r].name_ar).join('، ')}${leftP.length > 5 ? ` و${leftP.length - 5} غيرهم` : ''}`);
  const leftM = Object.keys(file.mutoon).filter(r => mp[r] == null || mp[r] === '');
  if (leftM.length) throw new HttpError(400, `حدّد المتون: ${leftM.map(r => file.mutoon[r].title).join('، ')}`);

  const plan = { persons: [], fills: [], remember: [], qiraat: [], riwayat: [], turuq: [], groups: [], mutoon: [], matnLinks: [], quranLinks: [] };

  // persons: an id here, or «ref:pX» for one created by the import
  const pid = {};
  Object.entries(file.persons).forEach(([ref, p]) => {
    if (pp[ref] === 'new') {
      pid[ref] = `ref:${ref}`;
      plan.persons.push({ key: `ref:${ref}`, ...p, uid: p.uid && !ctx.byUid.has(p.uid) ? p.uid : null });
      return;
    }
    const id = Number(pp[ref]);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `اختيار غير صالح لـ«${p.name_ar}»`);
    pid[ref] = id;
    if (p.uid) plan.remember.push({ uid: p.uid, person_id: id });
    const local = ctx.personsById.get(id);
    if (local) {
      const fields = Object.fromEntries(FILL.filter(k => p[k] != null && p[k] !== '' && (local[k] == null || local[k] === '')).map(k => [k, p[k]]));
      if (Object.keys(fields).length) plan.fills.push({ id, name_ar: local.name_ar, fields });
    }
  });
  const person = ref => (sacredId(ref) != null ? sacredId(ref) : pid[ref] ?? null);
  const isId = v => typeof v === 'number';

  // Quran names: the local one, or created (with what it hangs on) — only those connections use
  const qid = { ...ctx.qmap };
  const needQ = new Set();
  const need = (k, ref) => {
    if (!ref || needQ.has(ref)) return;
    needQ.add(ref);
    if (k === 'turuq') { const t = file.turuq[ref]; need('riwayat', t.riwaya); need('turuq', t.parent); }
    if (k === 'riwayat') need('qiraat', file.riwayat[ref].qiraa);
    // a group already here keeps its own members; a new one needs them
    if (k === 'groups' && qid[ref] == null) file.groups[ref].items.forEach(it => { need('qiraat', it.qiraa); need('riwayat', it.riwaya); });
  };
  file.quran.forEach(c => {
    c.items.forEach(it => { need('qiraat', it.qiraa); need('riwayat', it.riwaya); need('turuq', it.tariq); });
    (c.groups || []).forEach(g => need('groups', g));
  });
  const create = (k, ref, row) => { if (qid[ref] == null) { qid[ref] = `ref:${ref}`; plan[k].push({ key: `ref:${ref}`, ...row }); } };
  Object.entries(file.qiraat).filter(([r]) => needQ.has(r)).forEach(([r, q]) => create('qiraat', r, { name_ar: q.name_ar, imam: q.imam ? person(q.imam) : null }));
  Object.entries(file.riwayat).filter(([r]) => needQ.has(r)).forEach(([r, x]) => create('riwayat', r, { name_ar: x.name_ar, qiraa: qid[x.qiraa], rawi: x.rawi ? person(x.rawi) : null }));
  Object.entries(file.turuq).filter(([r]) => needQ.has(r)).forEach(([r, t]) => create('turuq', r, { name_ar: t.name_ar, riwaya: t.riwaya ? qid[t.riwaya] : null, parent: null, parentRef: t.parent }));
  plan.turuq.forEach(t => { t.parent = t.parentRef ? qid[t.parentRef] : null; delete t.parentRef; });
  const newGroups = Object.entries(file.groups || {}).filter(([r]) => needQ.has(r) && qid[r] == null);

  // mutoon: chosen, or created with their author
  const mid = {};
  const usedM = new Set([...file.links.map(l => l.matn).filter(Boolean),
    ...file.quran.flatMap(c => c.books || []), ...newGroups.flatMap(([, g]) => g.books)]);
  Object.entries(file.mutoon).forEach(([ref, m]) => {
    if (mp[ref] !== 'new') { mid[ref] = Number(mp[ref]); return; }
    if (!usedM.has(ref)) return;
    mid[ref] = `ref:${ref}`;
    plan.mutoon.push({ key: `ref:${ref}`, title: m.title, author: m.author ? person(m.author) : null, subject: m.subject, description: m.description });
  });
  const books = refs => [...new Set((refs || []).map(r => mid[r]).filter(v => v != null))];
  newGroups.forEach(([r, g]) => create('groups', r, {
    name_ar: g.name_ar, text_ar: g.text_ar, description: g.description, books: books(g.books),
    items: g.items.map(it => ({ qiraa: it.qiraa ? qid[it.qiraa] : null, riwaya: it.riwaya ? qid[it.riwaya] : null })),
  }));

  const seen = new Set();
  file.links.forEach(l => {
    const from = person(l.from), to = person(l.to), matn = l.matn ? mid[l.matn] : null;
    if (from === to) return;
    const key = `${from}:${to}:${matn ?? 'g'}`;
    if (seen.has(key)) return;
    seen.add(key);
    plan.matnLinks.push({
      from, to, matn, transmission_type_id: pickType(ctx.types, l.tx_kind, 'matn'), tx_kind: l.tx_kind,
      reading_mode: l.reading_mode, description: l.description,
      exists: isId(from) && isId(to) && (matn == null || isId(matn)) && ctx.existingMatn.has(key),
    });
  });
  file.quran.forEach(c => {
    const from = person(c.from), to = person(c.to);
    if (from === to) return;
    const items = c.items.map(it => ({ qiraa: it.qiraa ? qid[it.qiraa] : null, riwaya: it.riwaya ? qid[it.riwaya] : null, tariq: it.tariq ? qid[it.tariq] : null }));
    const groups = [...new Set((c.groups || []).map(g => qid[g]).filter(v => v != null))];
    const key = `${from}:${to}:${quranSignature(items, groups)}`;
    if (seen.has(`q:${key}`)) return;
    seen.add(`q:${key}`);
    plan.quranLinks.push({
      from, to, items, transmission_type_id: pickType(ctx.types, QURAN_KIND, 'quran'), tx_kind: QURAN_KIND,   // always read (quranReading)
      reading_mode: c.reading_mode, description: c.description, ijaza_date: c.ijaza_date, khatmat_count: c.khatmat_count, meeting_mode: c.meeting_mode,
      groups, books: books(c.books),
      // never «عام» for me; a v1 file: a link above mine naming nothing (services/quranChain)
      is_general: from !== 0 && (c.is_general ?? (!items.length && !groups.length)),
      exists: isId(from) && isId(to) && [...items.flatMap(it => [it.qiraa, it.riwaya, it.tariq]), ...groups].every(v => v == null || isId(v)) && ctx.existingQuran.has(key),
    });
  });
  return plan;
}

/** Same scope = same set of (qiraa, riwaya, tariq), whatever the order. */
function itemsSignature(items) {
  return items.map(it => [it.qiraa, it.riwaya, it.tariq].map(v => v ?? '').join('/')).sort().join(',');
}

/** …and the groups it was read with (same as itemsSignature when there are none). */
const quranSignature = (items, groups = []) =>
  `${itemsSignature(items)}${groups.length ? `|g:${[...groups].map(String).sort().join(',')}` : ''}`;

/** What a plan will do, for the preview and the result message. */
const planCounts = plan => ({
  persons: plan.persons.length, fills: plan.fills.length, mutoon: plan.mutoon.length,
  quranNames: plan.qiraat.length + plan.riwayat.length + plan.turuq.length + plan.groups.length,
  links: plan.matnLinks.filter(l => !l.exists).length + plan.quranLinks.filter(l => !l.exists).length,
  existing: plan.matnLinks.filter(l => l.exists).length + plan.quranLinks.filter(l => l.exists).length,
});

module.exports = { buildThabat, selection, validateThabat, previewThabat, planThabat, mapQuran, itemsSignature, quranSignature, planCounts, FORMAT, ME };
