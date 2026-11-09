const MC = require('../models/MatnConnectionModel');
const { requireValidLink } = require('../utils/httpError');

// the «عام — لكل المتون» box and an empty matn are the same thing: valid for every matn
const normalize = body => {
  const general = !!body?.is_general_ijaza || !body?.matn_id;
  return { ...body, matn_id: general ? null : body.matn_id, is_general_ijaza: general };
};

exports.list   = async (req, res) => res.json(await MC.findAll());
exports.create = async (req, res) => { requireValidLink(req.body); return res.json(await MC.create(normalize(req.body))); };
exports.update = async (req, res) => { requireValidLink(req.body); await MC.update(req.params.id, normalize(req.body)); return res.json({ ok: true }); };
exports.normalize = normalize;
exports.remove = async (req, res) => { await MC.remove(req.params.id); res.json({ ok: true }); };
