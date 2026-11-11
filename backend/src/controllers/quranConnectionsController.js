const QC = require('../models/QuranConnectionModel');
const TxType = require('../models/TxTypeModel');
const { requireValidLink } = require('../utils/httpError');

exports.list = async (req, res) => res.json(await QC.findAllForUser(req.user.id));

// every Quran link is saved as read on the shaykh (services/quranReading)
const asRead = async body => ({ ...body, transmission_type_id: await TxType.quranReadingId() });

exports.create = async (req, res) => {
  requireValidLink(req.body);
  const { items = [], books = [], ...fields } = await asRead(req.body);
  res.json(await QC.create(req.user.id, fields, items, books));
};

exports.update = async (req, res) => {
  requireValidLink(req.body);
  const { items = [], books = [], ...fields } = await asRead(req.body);
  await QC.update(req.params.id, req.user.id, fields, items, books);
  res.json({ ok: true });
};

exports.remove = async (req, res) => {
  await QC.remove(req.params.id, req.user.id);
  res.json({ ok: true });
};
