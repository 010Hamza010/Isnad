const QC = require('../models/QuranConnectionModel');
const { requireFields } = require('../utils/httpError');

exports.list = async (req, res) => {
  try { res.json(await QC.findAllForUser(req.user.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  requireFields(req.body, ['to_person_id']);
  try {
    const { items = [], ...fields } = req.body;
    res.json(await QC.create(req.user.id, fields, items));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  requireFields(req.body, ['to_person_id']);
  try {
    const { items = [], ...fields } = req.body;
    await QC.update(req.params.id, req.user.id, fields, items);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try { await QC.remove(req.params.id, req.user.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
};
