const QC = require('../models/QuranConnectionModel');
const { requireValidLink } = require('../utils/httpError');

exports.list = async (req, res) => res.json(await QC.findAllForUser(req.user.id));

exports.create = async (req, res) => {
  requireValidLink(req.body);
  const { items = [], ...fields } = req.body;
  res.json(await QC.create(req.user.id, fields, items));
};

exports.update = async (req, res) => {
  requireValidLink(req.body);
  const { items = [], ...fields } = req.body;
  await QC.update(req.params.id, req.user.id, fields, items);
  res.json({ ok: true });
};

exports.remove = async (req, res) => {
  await QC.remove(req.params.id, req.user.id);
  res.json({ ok: true });
};
