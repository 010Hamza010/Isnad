const Settings = require('../models/SettingsModel');
const P = require('../services/profile');

/** Profile of a user, falling back to the older per-feature settings until it is saved once. */
async function profileOf(userId) {
  const [stored, ijaza, isnad] = await Promise.all([
    Settings.get(userId, 'profile'), Settings.get(userId, 'ijaza'), Settings.get(userId, 'isnad_text'),
  ]);
  return P.mergeProfile(stored, { ijaza, isnad });
}
exports.profileOf = profileOf;

exports.get = async (req, res) => res.json(await profileOf(req.user.id));

exports.save = async (req, res) => {
  const profile = P.validateProfile(req.body);
  await Settings.set(req.user.id, 'profile', profile);
  res.json(profile);
};
