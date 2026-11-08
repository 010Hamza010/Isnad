const Ijaza    = require('../models/IjazaModel');
const Settings = require('../models/SettingsModel');
const IS       = require('../services/ijaza/settings');
const { HttpError, requireFields } = require('../utils/httpError');

const KEY = 'ijaza';
const MAX_BODY = 50000;

exports.getSettings = async (req, res) => {
  res.json({ settings: IS.mergeSettings(await Settings.get(req.user.id, KEY)), defaults: IS.DEFAULTS, designOptions: IS.designOptions() });
};

exports.saveSettings = async (req, res) => {
  const settings = IS.validateSettings(req.body);
  await Settings.set(req.user.id, KEY, settings);
  res.json({ settings });
};

exports.resetSettings = async (req, res) => {
  await Settings.remove(req.user.id, KEY);
  res.json({ settings: IS.mergeSettings(null) });
};

exports.list = async (req, res) => res.json(await Ijaza.findAllForUser(req.user.id));

exports.get = async (req, res) => {
  const row = await Ijaza.findById(req.params.id, req.user.id);
  if (!row) throw new HttpError(404, 'Not found');
  res.json(row);
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
  res.json(await Ijaza.create(req.user.id, { ...b, style: b.style || 'normal', details, student_name: String(b.student_name).trim().slice(0, 200) }));
};

exports.revoke = async (req, res) => {
  const reason = String(req.body?.reason ?? '').trim().slice(0, 255);
  await Ijaza.setRevoked(req.params.id, req.user.id, reason);
  res.json(await Ijaza.findById(req.params.id, req.user.id));
};

exports.unrevoke = async (req, res) => {
  await Ijaza.setRevoked(req.params.id, req.user.id, null);
  res.json(await Ijaza.findById(req.params.id, req.user.id));
};

exports.remove = async (req, res) => {
  await Ijaza.remove(req.params.id, req.user.id);
  res.json({ ok: true });
};
