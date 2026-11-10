import React from 'react';
import { routeTree, isGeneralRoute } from '../../utils/chains';

const SACRED = new Set([-1, -2, -3]); // النبي ﷺ، جبريل، رب العزة

const routesLabel = routes => (routes.length === 1 ? `الطريق ${routes[0]}` : `الطرق ${routes.join('، ')}`);

function Step({ edge, depths, kind, scope, last, general }) {
  return (
    <div className={`step ${kind}`}>
      <div className="step-rail">
        <div className="step-dot" />
        {!last && <div className="step-line" />}
      </div>
      <div className="step-body">
        <div className="step-name">
          {depths?.length > 0 && <span className="step-no" title="الترتيب من شيخي">{depths.join('/')}</span>}
          {edge.to_name || `#${edge.to_person_id}`}
        </div>
        {(edge.tx_name || scope || general) && (
          <div className="step-meta">
            {edge.tx_name && <span className="badge">{edge.tx_name}</span>}
            {general && <span className="badge badge-outline" title="اتصال شيخك بك عام — لكل المتون">عامة</span>}
            {scope && <span className="badge badge-primary">{scope}</span>}
          </div>
        )}
        {edge.description && <div className="step-desc">{edge.description}</div>}
      </div>
    </div>
  );
}

/**
 * One isnad group: me → firstEdge → routes drawn once where they agree, forking (again and
 * again) where they differ and re-joining on a shared tail. Each person carries its order from
 * my shaykh (1); `routes` numbers the chains (same order), `highlight` dims the other routes.
 * `endIds` are the persons where the chain is considered complete (author / imam).
 */
export default function ChainView({ firstEdge, chains, routes, endIds = [], scopeOf = () => null, highlight = null }) {
  const ends = new Set(endIds.filter(x => x != null).map(Number));
  const kindOf = e => {
    const id = Number(e.to_person_id);
    if (SACRED.has(id)) return 'sacred';
    if (ends.has(id)) return 'end';
    return '';
  };

  const tree = routeTree(chains, routes, 2);
  const reachedEnd = chains.length > 0 || ends.has(Number(firstEdge.to_person_id));

  const run = (steps, closes) => steps.map((s, i) => (
    <Step key={`${s.edge.from_person_id}-${s.edge.to_person_id}-${i}`} edge={s.edge} depths={s.depths} kind={kindOf(s.edge)}
      scope={scopeOf(s.edge)} last={closes && i === steps.length - 1} />
  ));

  const node = (t, closes) => (
    <>
      {run(t.prefix, closes && !t.forks.length && !t.suffix.length)}
      {t.forks.length > 0 && (
        <div className="branches">
          {t.forks.map(f => (
            <div key={f.routes.join()} className={`branch${highlight && !f.routes.includes(highlight) ? ' dim' : ''}`}>
              <div className="branch-label">{routesLabel(f.routes)}</div>
              {f.tree ? node(f.tree, true) : <div className="small muted">يتصل مباشرة بما بعده</div>}
            </div>
          ))}
        </div>
      )}
      {run(t.suffix, closes)}
    </>
  );

  return (
    <div className="chain">
      <div className="step me">
        <div className="step-rail"><div className="step-dot" /><div className="step-line" /></div>
        <div className="step-body"><div className="step-name">أنا</div></div>
      </div>

      {/* «عامة» only on my own link to my shaykh: higher up it is a scope, not how a link was received */}
      <Step edge={firstEdge} depths={[1]} kind={kindOf(firstEdge)} scope={scopeOf(firstEdge)} general={isGeneralRoute(firstEdge)}
        last={!tree.prefix.length && !tree.forks.length && !tree.suffix.length} />
      {node(tree, true)}

      {!reachedEnd && (
        <div className="munqati" style={{ marginTop: 10 }}>السند منقطع — لم يتصل بعدُ إلى نهايته</div>
      )}
    </div>
  );
}
