const Q = require('../models/QuranModel');
const { requireFields } = require('../utils/httpError');

exports.listQiraat  = async (_, res) => res.json(await Q.allQiraat());
exports.createQiraa = async (req, res) => { requireFields(req.body, ['name_ar']); res.json(await Q.createQiraa(req.body)); };
exports.updateQiraa = async (req, res) => { requireFields(req.body, ['name_ar']); await Q.updateQiraa(req.params.id, req.body); res.json({ ok: true }); };
exports.removeQiraa = async (req, res) => { await Q.removeQiraa(req.params.id); res.json({ ok: true }); };

exports.listRiwayat  = async (_, res) => res.json(await Q.allRiwayat());
exports.createRiwaya = async (req, res) => { requireFields(req.body, ['name_ar', 'qiraa_id']); res.json(await Q.createRiwaya(req.body)); };
exports.updateRiwaya = async (req, res) => { requireFields(req.body, ['name_ar', 'qiraa_id']); await Q.updateRiwaya(req.params.id, req.body); res.json({ ok: true }); };
exports.removeRiwaya = async (req, res) => { await Q.removeRiwaya(req.params.id); res.json({ ok: true }); };

exports.listTuruq  = async (_, res) => res.json(await Q.allTuruq());
exports.createTariq = async (req, res) => { requireFields(req.body, ['name_ar']); res.json(await Q.createTariq(req.body)); };
exports.updateTariq = async (req, res) => { requireFields(req.body, ['name_ar']); await Q.updateTariq(req.params.id, req.body); res.json({ ok: true }); };
exports.removeTariq = async (req, res) => { await Q.removeTariq(req.params.id); res.json({ ok: true }); };

const G = require('../services/quranGroups');
const Mutoon = require('../models/MutoonModel');
exports.listGroups  = async (_, res) => res.json(await Q.allGroups());
exports.createGroup = async (req, res) => res.json(await Q.createGroup(G.validateGroup(req.body)));
exports.updateGroup = async (req, res) => { await Q.updateGroup(req.params.id, G.validateGroup(req.body)); res.json({ ok: true }); };
exports.removeGroup = async (req, res) => { await Q.removeGroup(req.params.id); res.json({ ok: true }); };

// «أضف المجموعات المعروفة»: creates those not there yet (by name), with the qiraat found here
exports.addKnownGroups = async (req, res) => {
  const [qiraat, mutoon, existing] = await Promise.all([Q.allQiraat(), Mutoon.findAll(), Q.allGroups()]);
  const created = [], skipped = [];
  for (const g of G.planKnown({ qiraat, mutoon, existing })) {
    if (!g.items.length) { skipped.push({ name_ar: g.name_ar, missing: g.missing }); continue; }
    await Q.createGroup({ ...g, description: null });
    created.push({ name_ar: g.name_ar, missing: g.missing });
  }
  res.json({ created, skipped });
};
