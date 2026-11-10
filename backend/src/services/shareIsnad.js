/**
 * Share an isnad with another instance (whose person ids are different).
 * The file names people, it never relies on ids:
 *   { format: 'isnad-share', version: 1, exported_at, from, target,
 *     persons: { me: {…sender}, p12: { uid, name_ar, kunya, nisba, death_year, gender, region } },
 *     routes: [[{ to: 'p12', tx_kind, tx_name, reading_mode }, …], …] }   each route starts at «me»
 * «me» is the sender: on import it becomes one of the receiver's persons (their shaykh).
 * A person is matched by its uid when this instance has seen it before, otherwise by name.
 */
const { HttpError } = require('../utils/httpError');
const { resolveName } = require('./isnadText/resolve');

const FORMAT = 'isnad-share';
const VERSION = 1;
const REF_RE = /^[\w-]{1,40}$/;
const UID_RE = /^[0-9a-zA-Z-]{8,36}$/;
const MODES = new Set(['heart', 'looking']);
const ME = 'me';

const refOf = id => (Number(id) === 0 ? ME : `p${Number(id)}`);
const str = (v, max) => (v == null || v === '' ? null : String(v).slice(0, max));

/**
 * paths: enabled /graph paths groups; persons: Map id → row (with uid); sender: { name_ar, uid, gender };
 * target: { type: 'matn', title, author_id } | { type: 'quran', qiraa, riwaya, tariq }.
 */
function buildShare({ paths, persons, sender, target, now = new Date() }) {
  const used = new Set();
  const routes = [];
  paths.forEach(g => g.chains.forEach(chain => {
    // the sacred tail (النبي ﷺ ← جبريل ← رب العزة) is added by every instance itself
    const steps = [g.firstEdge, ...chain].filter(e => Number(e.to_person_id) > 0);
    if (!steps.length) return;
    routes.push(steps.map(e => {
      used.add(Number(e.to_person_id));
      return { to: refOf(e.to_person_id), tx_kind: e.tx_kind || null, tx_name: e.tx_name || null, reading_mode: e.reading_mode || null };
    }));
  }));

  const out = { [ME]: { uid: sender.uid || null, name_ar: sender.name_ar, gender: sender.gender === 'F' ? 'F' : 'M' } };
  used.forEach(id => {
    const p = persons.get(id) || {};
    out[refOf(id)] = {
      uid: p.uid || null, name_ar: p.name_ar || `#${id}`, kunya: p.kunya || null, nisba: p.nisba || null,
      death_year: p.death_year || null, gender: p.gender === 'F' ? 'F' : 'M', region: p.region || null,
    };
  });

  const t = target.type === 'matn'
    ? { type: 'matn', title: target.title, author: target.author_id && used.has(Number(target.author_id)) ? refOf(target.author_id) : null }
    : { type: 'quran', qiraa: target.qiraa || null, riwaya: target.riwaya || null, tariq: target.tariq || null };
  return { format: FORMAT, version: VERSION, exported_at: now.toISOString(), from: sender.name_ar, target: t, persons: out, routes };
}

/** Check a received file; returns a clean copy (unknown fields dropped). */
function validateShare(file) {
  if (!file || file.format !== FORMAT || typeof file.persons !== 'object' || !Array.isArray(file.routes))
    throw new HttpError(400, 'هذا الملف ليس إسناداً مُصدَّراً من «إسناد»');
  if (Number(file.version) > VERSION) throw new HttpError(400, 'الملف من إصدار أحدث — حدّث البرنامج أولاً');
  const refs = Object.keys(file.persons);
  if (refs.length > 5000 || file.routes.length > 2000) throw new HttpError(400, 'الملف كبير جداً');
  if (!file.persons[ME]) throw new HttpError(400, 'الملف لا يذكر المُرسِل');

  const persons = {};
  refs.forEach(ref => {
    const p = file.persons[ref];
    const name = String(p?.name_ar ?? '').trim();
    if (!REF_RE.test(ref) || !name || name.length > 200) throw new HttpError(400, `علَم غير صالح في الملف (${ref})`);
    persons[ref] = {
      uid: UID_RE.test(String(p.uid ?? '')) ? String(p.uid) : null,
      name_ar: name, kunya: str(p.kunya, 100), nisba: str(p.nisba, 150), death_year: str(p.death_year, 20),
      gender: p.gender === 'F' ? 'F' : 'M', region: str(p.region, 150),
    };
  });

  const routes = file.routes.map((r, i) => {
    if (!Array.isArray(r) || !r.length || r.length > 100) throw new HttpError(400, `الطريق ${i + 1} غير صالح`);
    return r.map(s => {
      if (!persons[s?.to] || s.to === ME) throw new HttpError(400, `الطريق ${i + 1} يذكر علَماً غير موجود في الملف`);
      return { to: s.to, tx_kind: str(s.tx_kind, 30), tx_name: str(s.tx_name, 100), reading_mode: MODES.has(s.reading_mode) ? s.reading_mode : null };
    });
  });

  const t = file.target || {};
  const target = t.type === 'quran'
    ? { type: 'quran', qiraa: str(t.qiraa, 200), riwaya: str(t.riwaya, 200), tariq: str(t.tariq, 200) }
    : { type: 'matn', title: str(t.title, 300), author: persons[t.author] && t.author !== ME ? t.author : null };
  return { format: FORMAT, version: VERSION, exported_at: str(file.exported_at, 40), from: str(file.from, 200), target, persons, routes };
}

/** Refs in reading order: the sender first, then each person as routes meet them. */
function usedRefs(file) {
  const seen = new Set([ME]);
  file.routes.forEach(r => r.forEach(s => seen.add(s.to)));
  return [...seen];
}

/** One person of a file → { status, person_id, candidates }: by known code, else by name (and death year). */
function resolvePerson(p, { byUid, index, personsById = new Map() }) {
  if (p.uid && byUid.has(p.uid)) return { status: 'linked', person_id: byUid.get(p.uid), candidates: [] };
  const r = resolveName(p.name_ar, index);
  let status = r.status === 'relative' ? 'ambiguous' : r.status;
  // same name, another death year: not the same person without the user's say
  const local = personsById.get(Number(r.person_id));
  if (status === 'matched' && p.death_year && local?.death_year && String(local.death_year) !== String(p.death_year)) status = 'ambiguous';
  if (status === 'matched' && Number(r.person_id) <= 0) status = 'ambiguous'; // never «me», never a sacred node
  return { status, person_id: status === 'matched' ? r.person_id : null, candidates: (r.candidates || []).filter(c => c.id > 0) };
}

/**
 * How each person of the file maps here. byUid: Map uid → local person id; index: resolve.buildIndex.
 * status: linked (known uid) | matched (one clear name match) | ambiguous | new.
 */
function previewShare(file, { byUid, index, personsById = new Map() }) {
  const rows = usedRefs(file).map(ref => {
    const p = file.persons[ref];
    const base = { ref, ...p, role: ref === ME ? 'sender' : ref === file.target.author ? 'author' : null };
    return { ...base, ...resolvePerson(p, { byUid, index, personsById }) };
  });
  const links = new Set();
  file.routes.forEach(r => r.forEach((s, i) => links.add(`${i ? r[i - 1].to : ME}>${s.to}`)));
  return { rows, counts: { routes: file.routes.length, persons: rows.length, links: links.size } };
}

/**
 * The reviewed file as fast-entry chains (services/isnadImport) + codes to remember.
 * picks: { ref: localPersonId | 'new' }. linkMe adds my own link to the sender.
 */
function toImport(file, picks, { byUid = new Map(), linkMe = false } = {}) {
  const refs = usedRefs(file);
  const left = refs.filter(r => picks?.[r] == null || picks[r] === '');
  if (left.length) throw new HttpError(400, `حدّد الأعلام: ${left.map(r => file.persons[r].name_ar).join('، ')}`);
  if (refs.some(r => picks[r] !== 'new' && Number(picks[r]) === 0)) throw new HttpError(400, 'لا يمكن أن يكون أحد أعلام الملف أنت');

  const node = ref => {
    const p = file.persons[ref];
    if (picks[ref] === 'new') {
      // a code already used here (the user overrode the match) stays with its person
      return { new_name: p.name_ar, new_key: ref, death_year: p.death_year, gender: p.gender, kunya: p.kunya, nisba: p.nisba, region: p.region, uid: p.uid && !byUid.has(p.uid) ? p.uid : null };
    }
    const id = Number(picks[ref]);
    if (!Number.isInteger(id)) throw new HttpError(400, 'معرّف غير صالح');
    return { person_id: id, name: p.name_ar };
  };

  const chains = file.routes.map(r => ({
    start: node(ME),
    links: r.map(s => ({ ...node(s.to), tx_kind: s.tx_kind, reading_mode: s.reading_mode })),
  }));
  if (linkMe) chains.unshift({ start: null, links: [{ ...node(ME), tx_kind: null, reading_mode: null }] });

  const remember = refs
    .filter(r => picks[r] !== 'new' && file.persons[r].uid)
    .map(r => ({ uid: file.persons[r].uid, person_id: Number(picks[r]) }));
  return { chains, remember };
}

module.exports = { buildShare, validateShare, previewShare, toImport, usedRefs, refOf, resolvePerson, FORMAT, ME };
