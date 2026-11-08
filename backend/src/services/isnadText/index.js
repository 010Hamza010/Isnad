/**
 * isnadText — bidirectional conversion between chains of connections and isnad prose.
 *   render: edges → «أخبرنا شيخنا فلان، عن فلان…»   (used for إجازات)
 *   parse:  prose → chains of { keyword, tx_type_id, name }   (used for fast entry / imports)
 *   resolve: parsed names → persons in the DB
 * Pure functions; keywords and style come from per-user settings.
 */
const { renderChain, renderChains, renderGroup, keywordFor } = require('./render');
const { parseIsnad } = require('./parse');
const { resolveName, resolveChains } = require('./resolve');
const { mergeSettings, validateSettings, SettingsError, DEFAULTS } = require('./settings');

// parsed chain → edges, so parse output can be rendered back
function toEdges(chain) {
  const edges = [];
  let from = { id: chain.start ? null : 0, name: chain.start };
  chain.links.forEach(l => {
    edges.push({ from_person_id: from.id, from_name: from.name, to_person_id: l.person_id ?? null, to_name: l.name, transmission_type_id: l.tx_type_id });
    from = { id: l.person_id ?? null, name: l.name };
  });
  return edges;
}

module.exports = {
  renderChain, renderChains, renderGroup, keywordFor,
  parseIsnad, resolveName, resolveChains, toEdges,
  mergeSettings, validateSettings, SettingsError, DEFAULTS,
};
