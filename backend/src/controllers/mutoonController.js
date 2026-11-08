const Matn = require('../models/MutoonModel');

exports.list   = async (req, res) => {
  const { connected } = req.query;

  if (connected) {
    res.json(await Matn.findAllConnected());
    
    return;
  }

  res.json(await Matn.findAll())
};


exports.create = async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'title required' });
  res.json(await Matn.create(req.body));
};

exports.update = async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'title required' });
  res.json(await Matn.update(req.params.id, req.body));
};
exports.remove = async (req, res) => { await Matn.remove(req.params.id); res.json({ ok: true }); };
