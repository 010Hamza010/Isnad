import React, { useMemo } from 'react';
import { layoutTree } from '../../utils/isnadTree';

const COL = 186, ROW = 96, BOX_W = 166, BOX_H = 54;
const SACRED = new Set([-1, -2, -3]);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const death = d => (d ? `ت ${/^\d+$/.test(String(d)) ? `${d}هـ` : d}` : '');

/** Isnad tree: the source at the top, branching down to me. Fixed colours (printed). */
export default function IsnadTree({ chains }) {
  const { nodes, edges, maxLevel, width } = useMemo(() => layoutTree(chains), [chains]);
  if (!edges.length) return null;

  const W = width * COL, H = (maxLevel + 1) * ROW;
  const pos = new Map(nodes.map(n => [n.id, { x: W / 2 - n.order * COL, y: (maxLevel - n.level) * ROW + (ROW - BOX_H) / 2 }]));

  return (
    <svg className="isnad-tree" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="شجرة الإسناد">
      <g fill="none" stroke="#b9a77a" strokeWidth="1.4">
        {edges.map(e => {
          const a = pos.get(e.from), b = pos.get(e.to);       // student (below) → teacher (above)
          const y1 = a.y, y2 = b.y + BOX_H, my = (y1 + y2) / 2;
          return <path key={`${e.from}-${e.to}`} d={`M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2}`} />;
        })}
      </g>
      {nodes.map(n => {
        const { x, y } = pos.get(n.id);
        const kind = n.id === 0 ? 'me' : SACRED.has(n.id) ? 'sacred' : n.level === maxLevel ? 'top' : '';
        const fill = { me: '#0f5e5c', sacred: '#f7edd6', top: '#f7edd6' }[kind] || '#fffdf6';
        const ink = kind === 'me' ? '#fffdf6' : kind ? '#7a5512' : '#1f2a2a';
        return (
          <g key={n.id} transform={`translate(${x - BOX_W / 2},${y})`}>
            <rect width={BOX_W} height={BOX_H} rx="8" fill={fill} stroke={kind ? '#a87a22' : '#cbbf9f'} />
            <text x={BOX_W / 2} y={n.death ? 23 : 32} textAnchor="middle" direction="rtl" fill={ink}
              fontFamily="Amiri, serif" fontSize="16" fontWeight="700">{clip(n.name, 22)}</text>
            {n.death && <text x={BOX_W / 2} y={42} textAnchor="middle" direction="rtl" fill={ink} opacity=".75"
              fontFamily="IBM Plex Sans Arabic, sans-serif" fontSize="11">{death(n.death)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
