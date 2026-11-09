/**
 * isnadText — bidirectional conversion between chains of connections and isnad prose.
 *   render: edges → «أخبرنا شيخنا فلان، عن فلان…»   (used for إجازات)
 *   parse:  prose → chains of { keyword, tx_kind, name }   (used for fast entry / imports)
 *   resolve: parsed names → persons in the DB
 * Pure functions; keywords and style come from per-user settings.
 */
const { newContext, renderChain, renderChains, renderGroup, groupChains, collectPersons, keywordFor, deathLabel } = require('./render');
const { parseIsnad } = require('./parse');
const { resolveName, resolveChains } = require('./resolve');
const { mergeSettings, validateSettings, SettingsError, DEFAULTS } = require('./settings');

// parsed chain → edges, so parse output can be rendered back
function toEdges(chain) {
  const edges = [];
  let from = { id: chain.start ? null : 0, name: chain.start, death: chain.start_death_year };
  chain.links.forEach(l => {
    edges.push({ from_person_id: from.id, from_name: from.name, from_death_year: from.death,
      to_person_id: l.person_id ?? null, to_name: l.name, to_death_year: l.death_year, tx_kind: l.tx_kind,
      reading_mode: l.reading_mode });
    from = { id: l.person_id ?? null, name: l.name, death: l.death_year };
  });
  return edges;
}

module.exports = {
  newContext, renderChain, renderChains, renderGroup, groupChains, collectPersons, keywordFor, deathLabel,
  parseIsnad, resolveName, resolveChains, toEdges,
  mergeSettings, validateSettings, SettingsError, DEFAULTS,
};
