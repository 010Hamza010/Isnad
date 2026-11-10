const Share = require('../models/ShareModel');
const Import = require('../models/ImportModel');
const TxType = require('../models/TxTypeModel');
const Settings = require('../models/SettingsModel');
const { matnData, quranData } = require('./graphController');
const { profileOf } = require('./profileController');
const S = require('../services/shareIsnad');
const { buildIndex } = require('../services/isnadText/resolve');
const { normalizeArabic } = require('../services/isnadText/normalize');
const { planImport, ImportError } = require('../services/isnadImport');
const { HttpError } = require('../utils/httpError');

const fileName = s => String(s || 'isnad').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 80);
const sendFile = (res, title, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="isnad-share.json"; filename*=UTF-8''${encodeURIComponent(`إسناد-${fileName(title)}.json`)}`);
  res.send(JSON.stringify(obj));
};

/** Who sends the file: my name from the profile, and my permanent code (person 0, or the instance's). */
async function sender(userId) {
  const profile = await profileOf(userId);
  const name = String(profile.short_name || profile.full_name || '').trim();
  if (!name) throw new HttpError(400, 'اكتب اسمك في «الملف الشخصي» أولاً — به يتعرّف المستلم عليك');
  const me = (await Share.withUids([0])).get(0);
  let uid = me?.uid;
  if (!uid) {
    uid = await Settings.get(userId, 'instance_uid');
    if (!uid) { uid = require('crypto').randomUUID(); await Settings.set(userId, 'instance_uid', uid); }
  }
  return { name_ar: name, uid, gender: profile.gender };
}

async function exportOf(userId, data, target) {
  if (!data.paths.length) throw new HttpError(400, 'لا يوجد سند متصل مفعّل لتصديره');
  const ids = [...data.paths.flatMap(g => [g.firstEdge, ...g.chains.flat()]).map(e => Number(e.to_person_id)).filter(id => id > 0)];
  const persons = await Share.withUids(ids);
  return S.buildShare({ paths: data.paths, persons, sender: await sender(userId), target });
}

exports.exportMatn = async (req, res) => {
  const data = await matnData(req.user.id, req.params.id);
  if (!data) throw new HttpError(404, 'المتن غير موجود');
  const file = await exportOf(req.user.id, data, { type: 'matn', title: data.matn.title, author_id: data.matn.author_id });
  sendFile(res, data.matn.title, file);
};

exports.exportQuran = async (req, res) => {
  const data = await quranData(req.user.id, req.query);
  const names = await Share.quranNames(req.query);
  const file = await exportOf(req.user.id, data, { type: 'quran', ...names });
  sendFile(res, [names.riwaya || names.qiraa, names.tariq].filter(Boolean).join('-'), file);
};

const same = (a, b) => a && b && normalizeArabic(a) === normalizeArabic(b);

/** Where the file's isnad could go here: a matn with the same title, the same qiraa / riwaya / tariq. */
async function suggestTarget(target) {
  const L = await Share.lists();
  if (target.type === 'matn') return { matn_id: L.mutoon.find(m => same(m.title, target.title))?.id || null };
  const qiraa = L.qiraat.find(q => same(q.name_ar, target.qiraa));
  const riwaya = L.riwayat.find(r => same(r.name_ar, target.riwaya) && (!qiraa || r.qiraa_id === qiraa.id));
  const tariq = riwaya && L.turuq.find(t => same(t.name_ar, target.tariq) && t.riwaya_id === riwaya.id);
  return { item: { qiraa_id: qiraa?.id || riwaya?.qiraa_id || null, riwaya_id: riwaya?.id || null, tariq_id: tariq?.id || null } };
}

// body: { file } → how every person of the file maps here, and where it could go
exports.preview = async (req, res) => {
  const file = S.validateShare(req.body?.file);
  const [persons, byUid] = await Promise.all([Share.persons(), Share.uidMap()]);
  const preview = S.previewShare(file, { byUid, index: buildIndex(persons), personsById: new Map(persons.map(p => [Number(p.id), p])) });
  res.json({ file: { from: file.from, exported_at: file.exported_at, target: file.target }, ...preview, suggest: await suggestTarget(file.target) });
};

// body: { file, picks: { ref: id|'new' }, target: { kind: 'matn'|'general'|'new_matn'|'quran', matn_id?, item? }, link_me, dry_run }
exports.import = async (req, res) => {
  const file = S.validateShare(req.body?.file);
  const { picks = {}, target = {}, link_me = false, dry_run = false } = req.body || {};
  if (!['matn', 'general', 'new_matn', 'quran'].includes(target.kind)) throw new HttpError(400, 'اختر أين يُحفظ الإسناد');
  if (target.kind === 'matn' && !Number(target.matn_id)) throw new HttpError(400, 'اختر المتن');
  if (target.kind === 'new_matn' && !file.target.title) throw new HttpError(400, 'لا عنوان للمتن في الملف');

  const byUid = await Share.uidMap();
  const { chains, remember } = S.toImport(file, picks, { byUid, linkMe: !!link_me });
  const it = target.item || {};
  const opts = {
    target: target.kind === 'quran' ? 'quran' : 'matn',
    matn_id: target.kind === 'matn' ? Number(target.matn_id) : null,
    items: target.kind === 'quran' && (it.qiraa_id || it.riwaya_id || it.tariq_id)
      ? [{ qiraa_id: it.qiraa_id || null, riwaya_id: it.riwaya_id || null, tariq_id: it.tariq_id || null }] : [],
    userId: req.user.id,
    remember,
  };
  if (target.kind === 'new_matn') {
    const author = file.target.author;
    opts.new_matn = { title: file.target.title, author: author == null ? null : picks[author] === 'new' ? `ref:${author}` : Number(picks[author]) };
  }

  const [types, existing] = await Promise.all([
    TxType.findAll(),
    target.kind === 'new_matn' ? new Set() : Import.existingPairs(opts),
  ]);
  let plan;
  try { plan = planImport(chains, { types, target: opts.target, existing }); }
  catch (e) { if (e instanceof ImportError) throw new HttpError(400, e.message); throw e; }
  if (dry_run) return res.json({ plan });
  res.json({ plan, result: await Import.apply(plan, opts) });
};
