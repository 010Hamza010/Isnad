const TxType = require('../models/TxTypeModel');

exports.list = async (req, res) => res.json(await TxType.findAll(req.query.applies_to));
