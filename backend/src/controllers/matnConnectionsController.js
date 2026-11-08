const MC = require('../models/MatnConnectionModel');
const { requireFields } = require('../utils/httpError');

exports.list   = async (req, res) => res.json(await MC.findAll());
exports.create = async (req, res) => { requireFields(req.body, ['to_person_id']); res.json(await MC.create(req.body)); };
exports.update = async (req, res) => { requireFields(req.body, ['to_person_id']); await MC.update(req.params.id, req.body); res.json({ ok: true }); };
exports.remove = async (req, res) => { await MC.remove(req.params.id); res.json({ ok: true }); };
