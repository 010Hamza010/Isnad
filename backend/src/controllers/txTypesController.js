const TxType = require('../models/TxTypeModel');
const { KEYS, KINDS } = require('../services/txKinds');
const { HttpError } = require('../utils/httpError');

exports.list = async (req, res) => res.json(await TxType.findAll(req.query.applies_to));

exports.kinds = async (req, res) => res.json(KINDS);

// set (or clear, to guess from the name again) the kind of a transmission type
exports.setKind = async (req, res) => {
  const kind = req.body?.kind || null;
  if (kind !== null && !KEYS.has(kind)) throw new HttpError(400, 'نوع غير معروف');
  await TxType.setKind(req.params.id, kind);
  res.json({ ok: true });
};
