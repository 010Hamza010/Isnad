const Person = require('../models/PersonModel');
const { requireFields, HttpError } = require('../utils/httpError');

const checkGender = b => {
  if (b.gender != null && b.gender !== '' && !['M', 'F'].includes(b.gender)) throw new HttpError(400, 'الجنس: M أو F');
};

exports.list   = async (req, res) => res.json(await Person.findAllWithLinks(req.query.q));
exports.create = async (req, res) => { requireFields(req.body, ['name_ar']); checkGender(req.body); res.json(await Person.create(req.body)); };
exports.update = async (req, res) => { requireFields(req.body, ['name_ar']); checkGender(req.body); res.json(await Person.update(req.params.id, req.body)); };
exports.remove = async (req, res) => { await Person.remove(req.params.id); res.json({ ok: true }); };
// body: { into, dry_run } → merge this person into `into` (dry_run: only count)
exports.merge  = async (req, res) => res.json(await Person.merge(req.params.id, req.body?.into, { dryRun: !!req.body?.dry_run }));
