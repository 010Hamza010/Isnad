const Person = require('../models/PersonModel');
const { requireFields } = require('../utils/httpError');

exports.list   = async (req, res) => res.json(await Person.findAll(req.query.q));
exports.create = async (req, res) => { requireFields(req.body, ['name_ar']); res.json(await Person.create(req.body)); };
exports.update = async (req, res) => { requireFields(req.body, ['name_ar']); res.json(await Person.update(req.params.id, req.body)); };
exports.remove = async (req, res) => { await Person.remove(req.params.id); res.json({ ok: true }); };
