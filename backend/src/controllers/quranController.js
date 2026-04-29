const Q = require('../models/QuranModel');

exports.listQiraat  = async (_, res) => res.json(await Q.allQiraat());
exports.createQiraa = async (req, res) => res.json(await Q.createQiraa(req.body));
exports.updateQiraa = async (req, res) => { await Q.updateQiraa(req.params.id, req.body); res.json({ ok: true }); };
exports.removeQiraa = async (req, res) => { await Q.removeQiraa(req.params.id); res.json({ ok: true }); };

exports.listRiwayat  = async (_, res) => res.json(await Q.allRiwayat());
exports.createRiwaya = async (req, res) => res.json(await Q.createRiwaya(req.body));
exports.updateRiwaya = async (req, res) => { await Q.updateRiwaya(req.params.id, req.body); res.json({ ok: true }); };
exports.removeRiwaya = async (req, res) => { await Q.removeRiwaya(req.params.id); res.json({ ok: true }); };

exports.listTuruq  = async (_, res) => res.json(await Q.allTuruq());
exports.createTariq = async (req, res) => res.json(await Q.createTariq(req.body));
exports.updateTariq = async (req, res) => { await Q.updateTariq(req.params.id, req.body); res.json({ ok: true }); };
exports.removeTariq = async (req, res) => { await Q.removeTariq(req.params.id); res.json({ ok: true }); };
