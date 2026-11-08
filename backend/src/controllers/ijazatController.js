const Ijaza    = require('../models/IjazaModel');
const Settings = require('../models/SettingsModel');
const IS       = require('../services/ijaza/settings');
const crypto   = require('crypto');
const { buildPayload } = require('../utils/qrPayload');
const { HttpError, requireFields } = require('../utils/httpError');

const KEY = 'ijaza';
const MAX_BODY = 50000;

const { profileOf } = require('./profileController');

// the shaykh's name, gender and default place come from the profile
const withProfile = (settings, profile) => ({
  ...settings, shaykh_name: profile.full_name, shaykh_gender: profile.gender, place: profile.place,
});

exports.getSettings = async (req, res) => {
  const profile = await profileOf(req.user.id);
  res.json({
    settings: withProfile(IS.mergeSettings(await Settings.get(req.user.id, KEY)), profile), profile,
    defaults: IS.DEFAULTS, designOptions: IS.designOptions(),
  });
};

exports.saveSettings = async (req, res) => {
  const settings = IS.validateSettings(req.body);
  await Settings.set(req.user.id, KEY, settings);
  res.json({ settings: withProfile(settings, await profileOf(req.user.id)) });
};

exports.resetSettings = async (req, res) => {
  await Settings.remove(req.user.id, KEY);
  res.json({ settings: withProfile(IS.mergeSettings(null), await profileOf(req.user.id)) });
};

// every row carries the exact text of its QR code
const withQr = row => (row ? { ...row, qr_payload: buildPayload(row) } : row);

exports.list = async (req, res) => res.json((await Ijaza.findAllForUser(req.user.id)).map(withQr));

exports.get = async (req, res) => {
  const row = await Ijaza.findById(req.params.id, req.user.id);
  if (!row) throw new HttpError(404, 'Not found');
  res.json(withQr(row));
};

exports.create = async (req, res) => {
  const b = req.body || {};
  requireFields(b, ['student_name', 'module', 'body', 'issued_at']);
  if (!IS.MODULES.includes(b.module)) throw new HttpError(400, 'Invalid module');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.issued_at)) throw new HttpError(400, 'Invalid date');
  if (String(b.body).length > MAX_BODY) throw new HttpError(400, 'Body too long');
  if (b.module === 'mutoon' && !b.matn_id) throw new HttpError(400, 'Missing fields: matn_id');
  if (b.style != null && !['normal', 'detailed'].includes(b.style)) throw new HttpError(400, 'Invalid style');
  // details: { notes, chains } snapshot for the detailed ijaza (margin notes + tree)
  let details = null;
  if (b.details != null) {
    details = JSON.stringify(b.details);
    if (typeof b.details !== 'object' || details.length > 200000) throw new HttpError(400, 'Invalid details');
  }
  // a correction replaces an earlier ijaza of this user that has not been replaced yet
  let replaces_id = null;
  if (b.replaces_id != null) {
    const old = await Ijaza.findById(b.replaces_id, req.user.id);
    if (!old) throw new HttpError(404, 'الإجازة المراد تصحيحها غير موجودة');
    if (old.replaced_by_code) throw new HttpError(409, `صدر لهذه الإجازة تصحيح بالفعل (${old.replaced_by_code})`);
    replaces_id = old.id;
  }
  res.json(withQr(await Ijaza.create(req.user.id, {
    ...b, style: b.style || 'normal', details, student_name: String(b.student_name).trim().slice(0, 200),
    replaces_id, replaces_reason: String(b.correction_reason ?? '').trim().slice(0, 150) || null,
  })));
};

exports.revoke = async (req, res) => {
  const reason = String(req.body?.reason ?? '').trim().slice(0, 255);
  await Ijaza.setRevoked(req.params.id, req.user.id, reason);
  res.json(withQr(await Ijaza.findById(req.params.id, req.user.id)));
};

exports.unrevoke = async (req, res) => {
  await Ijaza.setRevoked(req.params.id, req.user.id, null);
  res.json(withQr(await Ijaza.findById(req.params.id, req.user.id)));
};

// An issued ijaza is a document the student holds: it is never deleted, only revoked or corrected.
exports.remove = async () => {
  throw new HttpError(409, 'لا تُحذف إجازة صادرة — ألغِها أو أصدر تصحيحاً لها');
};

const MAX_DOC = 8 * 1024 * 1024;
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

/** Freeze the exact rendered document once (a standalone HTML page); its SHA-256 is the fingerprint. */
exports.freeze = async (req, res) => {
  const html = req.body?.html;
  if (typeof html !== 'string' || !/^<!doctype html>/i.test(html.trimStart())) throw new HttpError(400, 'مستند غير صالح');
  if (Buffer.byteLength(html) > MAX_DOC) throw new HttpError(413, 'المستند كبير جداً');
  // shown in a sandboxed frame without scripts anyway; refuse active content outright
  if (/<script|javascript:|<iframe|<object|<embed/i.test(html)) throw new HttpError(400, 'المستند يحتوي على محتوى غير مسموح');
  const row = await Ijaza.findById(req.params.id, req.user.id);
  if (!row) throw new HttpError(404, 'Not found');
  const hash = sha256(html);
  if (!(await Ijaza.freeze(row.id, req.user.id, html, hash))) throw new HttpError(409, 'حُفظت نسخة هذه الإجازة من قبل ولا تُغيَّر');
  res.json({ content_hash: hash });
};

exports.document = async (req, res) => {
  const doc = await Ijaza.documentById(req.params.id, req.user.id);
  if (!doc?.html) throw new HttpError(404, 'لا توجد نسخة محفوظة');
  res.json(doc);
};

const MAX_PDF = 20 * 1024 * 1024;

/** Attach the PDF actually delivered to the student, once. Raw body (application/pdf). */
exports.uploadPdf = async (req, res) => {
  const data = req.body;
  if (!Buffer.isBuffer(data) || data.length < 5 || data.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'الملف ليس PDF');
  if (data.length > MAX_PDF) throw new HttpError(413, 'الملف أكبر من 20 ميغابايت');
  const row = await Ijaza.findById(req.params.id, req.user.id);
  if (!row) throw new HttpError(404, 'Not found');
  let filename = 'ijaza.pdf';
  try { filename = decodeURIComponent(String(req.get('X-Filename') || filename)); } catch { /* keep default */ }
  filename = filename.replace(/[\/\\\r\n"]/g, '_').slice(0, 200);
  const meta = { filename, size: data.length, sha256: sha256(data), data };
  if (!(await Ijaza.savePdf(row.id, meta))) throw new HttpError(409, 'أُرفق ملف PDF لهذه الإجازة من قبل ولا يُستبدل');
  res.json({ pdf_sha256: meta.sha256, pdf_size: meta.size, pdf_filename: meta.filename });
};

const sendPdf = (res, f) => {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(f.size),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename || 'ijaza.pdf')}`,
    'X-Content-SHA256': f.sha256,
  });
  res.send(f.data);
};
exports.sendPdf = sendPdf;

exports.pdf = async (req, res) => {
  const f = await Ijaza.pdfById(req.params.id, req.user.id);
  if (!f) throw new HttpError(404, 'لا يوجد ملف PDF');
  sendPdf(res, f);
};
