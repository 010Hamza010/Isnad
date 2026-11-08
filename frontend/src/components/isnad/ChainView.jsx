import React from 'react';
import { splitChains } from '../../utils/chains';

const SACRED = new Set([-1, -2, -3]); // النبي ﷺ، جبريل، رب العزة

function Step({ edge, kind, scope, last }) {
  return (
    <div className={`step ${kind}`}>
      <div className="step-rail">
        <div className="step-dot" />
        {!last && <div className="step-line" />}
      </div>
      <div className="step-body">
        <div className="step-name">{edge.to_name || `#${edge.to_person_id}`}</div>
        {(edge.tx_name || scope) && (
          <div className="step-meta">
            {edge.tx_name && <span className="badge">{edge.tx_name}</span>}
            {scope && <span className="badge badge-primary">{scope}</span>}
          </div>
        )}
        {edge.description && <div className="step-desc">{edge.description}</div>}
      </div>
    </div>
  );
}

/**
 * One isnad group: me → firstEdge → (shared trunk → forks → re-joined tail).
 * `endIds` are the persons where the chain is considered complete (author / imam).
 */
export default function ChainView({ firstEdge, chains, endIds = [], scopeOf = () => null }) {
  const ends = new Set(endIds.filter(x => x != null).map(Number));
  const kindOf = e => {
    const id = Number(e.to_person_id);
    if (SACRED.has(id)) return 'sacred';
    if (ends.has(id)) return 'end';
    return '';
  };

  const { prefix, branches, suffix } = splitChains(chains);
  const trunk = [firstEdge, ...prefix];
  const reachedEnd = chains.length > 0 || ends.has(Number(firstEdge.to_person_id));

  const renderRun = (edges, closesChain) => edges.map((e, i) => (
    <Step key={`${e.from_person_id}-${e.to_person_id}-${i}`} edge={e} kind={kindOf(e)}
      scope={scopeOf(e)} last={closesChain && i === edges.length - 1} />
  ));

  return (
    <div className="chain">
      <div className="step me">
        <div className="step-rail"><div className="step-dot" /><div className="step-line" /></div>
        <div className="step-body"><div className="step-name">أنا</div></div>
      </div>

      {renderRun(trunk, !branches.length && !suffix.length)}

      {branches.length > 0 && (
        <div className="branches" style={{ gridTemplateColumns: `repeat(${Math.min(branches.length, 3)}, minmax(0, 1fr))` }}>
          {branches.map((b, i) => (
            <div key={i} className="branch">
              <div className="branch-label">الطريق {i + 1}</div>
              {renderRun(b, true)}
            </div>
          ))}
        </div>
      )}

      {renderRun(suffix, true)}

      {!reachedEnd && (
        <div className="munqati" style={{ marginTop: 10 }}>السند منقطع — لم يتصل بعدُ إلى نهايته</div>
      )}
    </div>
  );
}
