const MC = require('../models/MatnConnectionModel');
const { requireValidLink } = require('../utils/httpError');

exports.list   = async (req, res) => res.json(await MC.findAll());
exports.create = async (req, res) => { requireValidLink(req.body); res.json(await MC.create(req.body)); };
exports.update = async (req, res) => { requireValidLink(req.body); await MC.update(req.params.id, req.body); res.json({ ok: true }); };
exports.remove = async (req, res) => { await MC.remove(req.params.id); res.json({ ok: true }); };
