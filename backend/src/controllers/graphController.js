const GM = require('../models/GraphModel');
const { buildPaths, formatPath } = require('../services/graphService');
const Settings = require('../models/SettingsModel');
const DR = require('../services/disabledRoutes');

const DISABLED_KEY = 'disabled_routes';
const disabledIn = async (userId, scope) => ((await Settings.get(userId, DISABLED_KEY)) || {})[scope] || [];

const QURAN_TAIL = [
  { from_person_id: -1, to_person_id: -2,
    from_name: 'النبي ﷺ', to_name: 'جبريل عليه السلام',
    tx_name: 'وحي', description: 'تلقى النبي ﷺ القرآن من جبريل عليه السلام', items: [] },
  { from_person_id: -2, to_person_id: -3,
    from_name: 'جبريل عليه السلام', to_name: 'رب العزة',
    tx_name: 'وحي', description: 'جبريل أمين الوحي نزل به من عند الله', items: [] },
];

/** Routes of a matn for this user (disabled ones apart); null when the matn does not exist. */
async function matnData(userId, matnId) {
  const { matn, edges } = await GM.getMatnWithEdges(matnId);
  if (!matn) return null;
  const scope = DR.matnScope(matn.id);
  if (!matn.author_id) return { matn, scope, paths: [], disabled: [] };
  const pMap = await GM.getAllPersons();
  const raw  = buildPaths(edges, 0, [matn.author_id], null, null, null, pMap, null, null);
  const { paths, disabled } = DR.applyDisabled(raw.map(group => formatPath(group, pMap)), await disabledIn(userId, scope));
  return { matn, scope, paths, disabled };
}
exports.matnData = matnData;

exports.matnPaths = async (req, res) => {
  try {
    const data = await matnData(req.user.id, req.params.id);
    if (!data) return res.status(404).json({ error: 'Matn not found' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

/** Routes of a Quran option (riwaya / tariq / qiraa) for this user, with the sacred tail. */
async function quranData(userId, query) {
  const { riwaya_id, tariq_id, qiraa_id } = query;

  let riwaya = null, imamId = null, qiraaId = null;

  // Priority: riwaya_id > qiraa_id
  if (riwaya_id) {
    riwaya  = await GM.getRiwayaById(riwaya_id);
    imamId  = riwaya?.imam_id;
    qiraaId = riwaya?.qiraa_id;
  } else if (qiraa_id) {
    // No riwaya filter — just qiraa level
    qiraaId = Number(qiraa_id);
    // Find the imam of this qiraa to use as target
    const qiraaRow = await GM.getQiraaById(qiraaId);

    imamId = qiraaRow?.imam_id || null;
  }

  const edges          = await GM.getQuranEdgesForUser(userId);
  const pMap           = await GM.getAllPersons();
  const imamMap        = await GM.getImamMap();
  const riwayaQiraaMap = await GM.getRiwayaQiraaMap();

  const raw = buildPaths(
    edges, 0,
    imamId ? [imamId] : [-1],
    riwaya_id ? Number(riwaya_id) : null,
    tariq_id  ? Number(tariq_id)  : null,
    qiraaId   ? Number(qiraaId)   : null,
    pMap, imamMap, riwayaQiraaMap
  );

  const scope = DR.quranScope({ riwaya_id, tariq_id, qiraa_id: riwaya_id ? null : qiraaId });
  const { paths: enabled, disabled } = DR.applyDisabled(raw.map(group => formatPath(group, pMap)), await disabledIn(userId, scope));

  const paths = enabled.map(formatted => {

    // append النبي + tail to each chain
    formatted.chains = formatted.chains.map(chain => {
      const fullChain = [...chain];
      if (imamId) {
        const last = fullChain[fullChain.length - 1];
        const fromName = last ? last.to_name
          : (pMap.get(Number(formatted.firstEdge.to_person_id))?.name_ar || '');
        fullChain.push({
          from_person_id: imamId, from_name: fromName,
          to_person_id: -1, to_name: 'النبي ﷺ',
          tx_name: 'تلقي مباشر', description: null, items: [],
        });
      }
      QURAN_TAIL.forEach(t => fullChain.push({ ...t }));
      return fullChain;
    });

    // if no upper chain exists (direct connection to imam)
    if (formatted.chains.length === 0) {
      const chain = [];
      if (imamId) {
        chain.push({
          from_person_id: formatted.firstEdge.to_person_id,
          from_name: formatted.firstEdge.to_name,
          to_person_id: -1, to_name: 'النبي ﷺ',
          tx_name: 'تلقي مباشر', description: null, items: [],
        });
      }
      QURAN_TAIL.forEach(t => chain.push({ ...t }));
      formatted.chains = [chain];
    }

    return formatted;
  });

  return { riwaya, scope, paths, disabled };
}
exports.quranData = quranData;

exports.quranPaths = async (req, res) => {
  try { res.json(await quranData(req.user.id, req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.fullGraph = async (req, res) => {
  try {
    const data = await GM.getFullGraphData(req.user.id, req.query.module || 'both');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
// body: { keys: [routeKey], disabled: true|false } → { keys: the scope's disabled routes }
exports.setDisabledRoutes = async (req, res) => {
  const keys = DR.validate(req.params.scope, req.body?.keys);
  const all = DR.setDisabled(await Settings.get(req.user.id, DISABLED_KEY), req.params.scope, keys, req.body?.disabled !== false);
  await Settings.set(req.user.id, DISABLED_KEY, all);
  res.json({ keys: all[req.params.scope] || [] });
};
