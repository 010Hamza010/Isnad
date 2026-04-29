import React from 'react';

const specialStyle = id => {
  if (Number(id) === -3) return { background: '#fff8e1', border: '1px solid #ffc107', color: '#e65100', fontWeight: 800 };
  if (Number(id) === -2) return { background: '#e8f5e9', border: '1px solid #4caf50', color: '#1b5e20', fontWeight: 700 };
  if (Number(id) === -1) return { background: '#e3f2fd', border: '1px solid #2196f3', color: '#0d47a1', fontWeight: 700 };
  return null;
};

export default function ChainTree({ paths, endLabel = 'المؤلف', compact = false }) {
  if (!paths || paths.length === 0)
    return <div className="empty-state"><div className="empty-icon">🔍</div><p>لا يوجد مسار متصل</p></div>;

  return (
    <div>
      {paths.map((path, pi) => (
        <div key={pi} className="path-card" style={{ marginBottom: compact ? 8 : 12 }}>
          <div className="path-header">
            <span>المسار {pi + 1}</span>
            <span>{path.length} حلقة</span>
          </div>
          <div style={{ padding: compact ? '8px 10px' : '12px 14px' }}>
            <div className="chain-tree">

              {/* أنا — نقطة البداية */}
              <div className="chain-node cn-you">
                <div className="chain-dot d-you" />
                <div>
                  <div className="chain-node-name">أنا</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>نقطة البداية</div>
                </div>
              </div>

              {path.map((edge, i) => {
                const isLast  = i === path.length - 1;
                const sp      = specialStyle(edge.to_person_id);
                const isSpecial = !!sp;

                return (
                  <React.Fragment key={i}>
                    <div className="chain-connector" />
                    <div
                      className={`chain-node${isLast && !isSpecial ? ' cn-end' : ''}`}
                      style={sp ? { ...sp, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'flex-start', gap: 10, padding: compact ? '6px 10px' : '10px 14px' } : {}}
                    >
                      <div className={`chain-dot ${isLast && !isSpecial ? 'd-end' : isSpecial ? '' : 'd-mid'}`}
                        style={sp ? { width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: sp.color } : {}} />
                      <div style={{ flex: 1 }}>
                        <div className="chain-node-name" style={sp ? { color: sp.color, fontWeight: sp.fontWeight } : {}}>
                          {edge.to_name || `شخص #${edge.to_person_id}`}
                        </div>
                        <div className="chain-node-meta">
                          {edge.tx_name     && <span className="badge badge-teal">{edge.tx_name}</span>}
                          {edge.matn_title  && <span className="badge badge-gray">{edge.matn_title}</span>}
                          {edge.riwaya_name && <span className="badge badge-gold">{edge.riwaya_name}</span>}
                          {edge.tariq_name  && <span className="badge badge-purple">{edge.tariq_name}</span>}
                          {isLast && !isSpecial && <span className="badge badge-green">{endLabel}</span>}
                        </div>
                        {edge.description && (
                          <div className="chain-node-desc">{edge.description}</div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function commonSuffix(chains) {
  if (!chains.length) return [];
  if (chains.length === 1) return chains[0];

  const keys = chains.map(c =>
    c.map(e => `${e.from_person_id}-${e.to_person_id}`)
  );

  // find how many edges from the END are identical across all chains
  let suffixLen = 0;
  const minLen = Math.min(...chains.map(c => c.length));

  for (let i = 1; i <= minLen; i++) {
    const tailKey = keys[0][keys[0].length - i];
    if (keys.every(k => k[k.length - i] === tailKey)) suffixLen = i;
    else break;
  }

  return suffixLen > 0 ? chains[0].slice(chains[0].length - suffixLen) : [];
}

// Split chains into: shared prefix, diverging middles, shared suffix
export function splitChains(chains) {
  if (!chains.length) return { prefix: [], branches: [], suffix: [] };
  if (chains.length === 1) return { prefix: chains[0], branches: [], suffix: [] };

  const keys = chains.map(c =>
    c.map(e => `${e.from_person_id}-${e.to_person_id}`)
  );

  // shared prefix
  let prefixLen = 0;
  const minLen = Math.min(...chains.map(c => c.length));
  for (let i = 0; i < minLen; i++) {
    if (keys.every(k => k[i] === keys[0][i])) prefixLen = i + 1;
    else break;
  }

  const prefix   = chains[0].slice(0, prefixLen);
  const trimmed  = chains.map(c => c.slice(prefixLen));

  // shared suffix of the trimmed parts
  const suffix    = commonSuffix(trimmed);
  const suffixLen = suffix.length;
  const branches  = trimmed.map(c => c.slice(0, c.length - suffixLen));

  return { prefix, branches, suffix };
}

export const ChainView = ({ chains, stepScope, S, authorId }) => {
  if (!chains.length) return null;

  const { prefix, branches, suffix } = splitChains(chains);

  const renderEdges = (edges) => edges.map((edge, ei) => {
    const isLast    = ei === edges.length - 1;
    const isSpecial = Number(edge.to_person_id) < 0 || (authorId && Number(edge.to_person_id) === Number(authorId));
    const scope     = stepScope(edge);
    return (
      <div key={`${edge.from_person_id}-${edge.to_person_id}`} style={S.stepRow}>
        <div style={S.dotCol}>
          <div style={S.dot(isSpecial)} />
          {!isLast && <div style={S.line} />}
        </div>
        <div style={S.stepContent(isLast)}>
          <div style={S.toName(isSpecial)}>{edge.to_name}</div>
          <div style={S.scopeRow}>
            {edge.tx_name && <span style={S.badge('#f0f0ee','#777')}>{edge.tx_name}</span>}
            {scope        && <span style={S.badge('#e6f4f4','#016f6f')}>{scope}</span>}
          </div>
          {edge.description && <div style={S.desc}>{edge.description}</div>}
        </div>
      </div>
    );
  });

  const hasBranches = branches.some(b => b.length > 0);

  return (
    <>
      {/* shared prefix */}
      {renderEdges(prefix)}

      {/* diverging branches */}
      {hasBranches && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${branches.filter(b=>b.length).length}, 1fr)`,
          gap: 10, marginTop: 4,
          borderTop: '1px dashed #e5e5e0', paddingTop: 10,
          marginBottom: suffix.length ? 4 : 0,
        }}>
          {branches.filter(b => b.length > 0).map((branch, i) => (
            <div key={i} style={{
              background: '#f9f9f7', borderRadius: 8,
              padding: '10px 12px', border: '1px solid #ebebeb',
            }}>
              {renderEdges(branch)}
            </div>
          ))}
        </div>
      )}

      {/* shared suffix — back to single line */}
      {suffix.length > 0 && (
        <div style={{
          borderTop: hasBranches ? '1px dashed #e5e5e0' : 'none',
          paddingTop: hasBranches ? 10 : 0, marginTop: hasBranches ? 4 : 0,
        }}>
          {renderEdges(suffix)}
        </div>
      )}
    </>
  );
};