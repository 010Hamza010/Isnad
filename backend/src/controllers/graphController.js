const GM = require('../models/GraphModel');
const { buildPaths, formatPath, formatEdge } = require('../services/graphService');
const QC = require('../services/quranChain');
const Settings = require('../models/SettingsModel');
const DR = require('../services/disabledRoutes');
const H = require('../services/heights');
const Mutoon = require('../models/MutoonModel');
const Quran = require('../models/QuranModel');

const DISABLED_KEY = 'disabled_routes';
const disabledIn = async (userId, scope) => ((await Settings.get(userId, DISABLED_KEY)) || {})[scope] || [];

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
  const data = await matnData(req.user.id, req.params.id);
  if (!data) return res.status(404).json({ error: 'Matn not found' });
  res.json(data);
};

/**
 * Routes of a Quran choice for this user: { riwaya_id | qiraa_id, tariq_id? } where tariq_id «0» means
 * my links without a tariq and no tariq_id means any. See services/quranChain for the rule.
 */
async function quranData(userId, query) {
  const riwaya_id = Number(query.riwaya_id) || null;
  const tariq = query.tariq_id === undefined || query.tariq_id === '' ? undefined : Number(query.tariq_id) || 0;
  const riwaya = riwaya_id ? await GM.getRiwayaById(riwaya_id) : null;
  const qiraaId = riwaya?.qiraa_id || Number(query.qiraa_id) || null;
  const qiraa = !riwaya && qiraaId ? await GM.getQiraaById(qiraaId) : null;
  const imamId = riwaya?.imam_id ?? qiraa?.imam_id ?? null;
  const rawiId = riwaya?.rawi_id ?? null;

  const [edges, pMap, riwayaQiraa] = await Promise.all([GM.getQuranEdgesForUser(userId), GM.getAllPersons(), GM.getRiwayaQiraaMap()]);
  const mine  = edges.filter(e => Number(e.from_person_id) === 0 && QC.startCovers(e, { qiraa_id: qiraaId, riwaya_id, tariq }, riwayaQiraa));
  const upper = edges.filter(e => Number(e.from_person_id) !== 0).map(e => ({ ...e, items: [], books: undefined }));   // complete: read everything

  const target = rawiId ?? imamId ?? QC.PROPHET;
  const raw = buildPaths([...mine, ...upper], 0, [target], null, null, null, pMap, null, null);

  const scope = DR.quranScope({ riwaya_id, tariq_id: tariq, qiraa_id: riwaya_id ? null : qiraaId });
  const { paths: enabled, disabled } = DR.applyDisabled(raw.map(group => formatPath(group, pMap)), await disabledIn(userId, scope));

  const fmt = e => formatEdge(e, pMap);
  const step = (from, to, extra) => ({ ...formatEdge({ from_person_id: from, to_person_id: to, items: [] }, pMap),
    ...(to === QC.PROPHET ? { to_name: 'النبي ﷺ' } : {}), tx_name: extra.auto ? 'قراءة' : null, tx_kind: extra.auto ? 'qiraa' : null, ...extra });
  const paths = QC.completeGroups(enabled, QC.above({ rawiId, imamId, upper, fmt, step }));
  return { riwaya, scope, paths, disabled };
}
exports.quranData = quranData;

exports.quranPaths = async (req, res) => res.json(await quranData(req.user.id, req.query));

// «أعلى أسانيدك»: fewest wasait to each matn's author and, per riwaya of my Quran links, to the Prophet ﷺ
exports.heights = async (req, res) => {
  const userId = req.user.id;
  const [mutoon, allEdges, pMap, disabled, items] = await Promise.all([
    Mutoon.findAll(), GM.getAllMatnEdges(), GM.getAllPersons(),
    Settings.get(userId, DISABLED_KEY), GM.getMyQuranItems(userId),
  ]);
  const mutoonRows = [];
  for (const m of mutoon) {
    if (!m.author_id) continue;
    // same edges as getMatnWithEdges: this matn's, and the general ones
    const edges = allEdges.filter(e => Number(e.matn_id) === Number(m.id) || e.matn_id == null || Number(e.is_general_ijaza));
    const raw = buildPaths(edges, 0, [m.author_id], null, null, null, pMap, null, null);
    if (!raw.length) continue;
    const { paths } = DR.applyDisabled(raw.map(g => formatPath(g, pMap)), (disabled || {})[DR.matnScope(m.id)] || []);
    const h = H.fewest(paths);
    if (h) mutoonRows.push({ id: m.id, label: m.title, author_name: m.author_name, ...h });
  }
  const quranRows = [];
  for (const o of H.quranOptions(items, await Quran.allRiwayat())) {
    const h = H.fewest((await quranData(userId, o)).paths, -1);
    if (h) quranRows.push({ ...o, ...h });
  }
  res.json({ mutoon: H.byHeight(mutoonRows), quran: H.byHeight(quranRows) });
};

exports.fullGraph = async (req, res) => res.json(await GM.getFullGraphData(req.user.id, req.query.module || 'both'));
// body: { keys: [routeKey], disabled: true|false } → { keys: the scope's disabled routes }
exports.setDisabledRoutes = async (req, res) => {
  const keys = DR.validate(req.params.scope, req.body?.keys);
  const all = DR.setDisabled(await Settings.get(req.user.id, DISABLED_KEY), req.params.scope, keys, req.body?.disabled !== false);
  await Settings.set(req.user.id, DISABLED_KEY, all);
  res.json({ keys: all[req.params.scope] || [] });
};
