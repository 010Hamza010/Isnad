const Settings = require('../models/SettingsModel');
const Person   = require('../models/PersonModel');
const T        = require('../services/isnadText');
const { HttpError } = require('../utils/httpError');

const KEY = 'isnad_text';
const MAX_TEXT = 20000;

const validate = input => {
  try { return T.validateSettings(input); }
  catch (e) { if (e instanceof T.SettingsError) throw new HttpError(400, e.message); throw e; }
};

// Settings sent with the request (unsaved preview) win over the stored ones.
const settingsFor = async req =>
  req.body?.settings ? validate(req.body.settings) : T.mergeSettings(await Settings.get(req.user.id, KEY));

exports.getSettings = async (req, res) => {
  res.json({ settings: T.mergeSettings(await Settings.get(req.user.id, KEY)), defaults: T.DEFAULTS });
};

exports.saveSettings = async (req, res) => {
  const settings = validate(req.body);
  await Settings.set(req.user.id, KEY, settings);
  res.json({ settings });
};

exports.resetSettings = async (req, res) => {
  await Settings.remove(req.user.id, KEY);
  res.json({ settings: T.mergeSettings(null) });
};

// body: { group } (a /graph/*/paths group) or { chains: [[edge]] }, optional { style } override
// (e.g. the ijaza page turns on clear phrases, death years and note markers).
exports.render = async (req, res) => {
  const { group, chains, style } = req.body || {};
  if (!group?.firstEdge && !Array.isArray(chains)) throw new HttpError(400, 'Missing fields: group or chains');
  let s = await settingsFor(req);
  if (style && typeof style === 'object') s = validate({ ...s, style: { ...s.style, ...style } });
  const list = group ? T.groupChains(group) : chains;
  res.json({ text: T.renderChains(list, s), persons: T.collectPersons(list) });
};

// body: { text } → parsed chains with each name resolved against persons, plus the text re-rendered
exports.parse = async (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'Missing fields: text');
  if (text.length > MAX_TEXT) throw new HttpError(400, 'Text too long');
  const s = await settingsFor(req);
  const parsed = T.parseIsnad(text, s);
  const chains = T.resolveChains(parsed, await Person.findAll());
  res.json({
    chains,
    warnings: parsed.warnings,
    rendered: T.renderChains(chains.map(c => T.toEdges({ ...c, start: c.start?.name ?? null, start_death_year: c.start?.death_year })), s),
  });
};
