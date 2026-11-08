import React, { useEffect, useMemo, useState } from 'react';
import { layoutTree, wrapText, txCategory, inDegrees } from '../../utils/isnadTree';

const SACRED = new Set([-1, -2, -3]);
const TX = {
  sama:  { color: 'txSama',  label: 'سماع' },
  qiraa: { color: 'txQiraa', label: 'قراءة' },
  ard:   { color: 'txArd',   label: 'عرض' },
  ijaza: { color: 'txIjaza', label: 'إجازة', dash: true },
  other: { color: 'txOther', label: 'غير محدد' },
};
const death = d => (d ? `ت ${/^\d+$/.test(String(d)) ? `${d}هـ` : d}` : '');

// text width with the real font (canvas), so boxes fit names exactly
let canvas;
const measurer = (family, size, weight = 700) => {
  canvas ||= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${weight} ${size}px "${family}", serif`;
  return t => ctx.measureText(t).width;
};

function useFontsTick(family) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.load(`16px "${family}"`).then(() => alive && setTick(t => t + 1)).catch(() => {});
    return () => { alive = false; };
  }, [family]);
  return tick;
}

/** Sizes and positions of every box, row by row (source on top, me at the bottom). */
function computeLayout(chains, design) {
  const { nodes, edges, maxLevel } = layoutTree(chains);
  const family = design.fonts.tree.family;
  const fs = design.fonts.tree.size * 1.333;          // pt → px (SVG units)
  const nameW = measurer(family, fs, 700);
  const deathFs = fs * 0.78;
  const padX = fs * 0.7, padY = fs * 0.45, lineH = fs * 1.3;
  const maxText = fs * 7.5;                            // wrap names wider than ~7.5em
  const hGap = fs * 0.9, vGap = fs * 2.4;

  const boxes = new Map(nodes.map(n => {
    const lines = wrapText(n.name, maxText, nameW);
    const textW = Math.max(...lines.map(nameW), n.death ? measurer(family, deathFs, 400)(death(n.death)) : 0);
    const w = Math.max(textW + padX * 2, fs * 4);
    const h = padY * 2 + lines.length * lineH + (n.death ? deathFs * 1.25 : 0);
    return [n.id, { ...n, lines, w, h }];
  }));

  const rows = Array.from({ length: maxLevel + 1 }, (_, l) =>
    [...boxes.values()].filter(b => b.level === l).sort((a, b) => a.order - b.order));
  const rowW = rows.map(r => r.reduce((s, b) => s + b.w, 0) + hGap * Math.max(0, r.length - 1));
  const rowH = rows.map(r => Math.max(0, ...r.map(b => b.h)));
  const W = Math.max(...rowW) + fs;

  let y = fs * 0.5;
  for (let l = maxLevel; l >= 0; l--) {                // top row = highest level (the source)
    let x = (W - rowW[l]) / 2;
    rows[l].forEach(b => {
      b.cx = x + b.w / 2;
      b.y = y + (rowH[l] - b.h) / 2;
      x += b.w + hGap;
    });
    y += rowH[l] + vGap;
  }
  const H = y - vGap + fs * 0.5;

  const ins = inDegrees(edges);
  const outs = new Set(edges.map(e => e.from));
  const direct = new Set(edges.filter(e => e.from === 0).map(e => e.to));
  [...boxes.values()].forEach(b => {
    b.kind = b.id === 0 ? 'me' : SACRED.has(b.id) ? 'sacred' : !outs.has(b.id) ? 'source' : direct.has(b.id) ? 'direct' : '';
    b.joins = ins.get(b.id) || 0;
  });

  return { boxes, edges, W, H, fs, deathFs, padY, lineH, family };
}

/**
 * Isnad tree for the detailed ijaza. Fits the remaining page area (vector, scales cleanly).
 * Colours: line by transmission type, box by role; a badge marks where chains meet.
 */
export default function IsnadTree({ chains, design }) {
  const tick = useFontsTick(design.fonts.tree.family);
  const L = useMemo(() => computeLayout(chains, design), [chains, design, tick]);
  const c = design.colors;
  if (!L.edges.length) return null;

  const used = new Set(L.edges.map(e => txCategory(e.tx)));
  const hasJoins = [...L.boxes.values()].some(b => b.joins > 1);

  return (
    <div className="tree-wrap">
      <svg className="isnad-tree" viewBox={`0 0 ${L.W} ${L.H}`} preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision" textRendering="geometricPrecision" role="img" aria-label="شجرة الإسناد">
        <g fill="none" strokeLinecap="round">
          {L.edges.map(e => {
            const a = L.boxes.get(e.from), b = L.boxes.get(e.to);   // student (below) → teacher (above)
            const y1 = a.y, y2 = b.y + b.h, my = (y1 + y2) / 2;
            const t = TX[txCategory(e.tx)];
            return (
              <path key={`${e.from}-${e.to}`} d={`M${a.cx},${y1} C${a.cx},${my} ${b.cx},${my} ${b.cx},${y2}`}
                stroke={c[t.color]} strokeWidth={L.fs * 0.11} strokeDasharray={t.dash ? `${L.fs * 0.35} ${L.fs * 0.25}` : undefined} />
            );
          })}
        </g>
        {[...L.boxes.values()].map(b => {
          const fill = { me: c.treeMe, source: c.treeSource, sacred: c.treeSource }[b.kind] || c.treeNode;
          const stroke = { me: c.treeMe, sacred: c.sacred, source: c.title, direct: c.treeMe }[b.kind] || c.treeNodeBorder;
          const ink = b.kind === 'me' ? c.paper : b.kind === 'sacred' ? c.sacred : c.treeText;
          const x = b.cx - b.w / 2;
          return (
            <g key={b.id}>
              <rect x={x} y={b.y} width={b.w} height={b.h} rx={L.fs * 0.35} fill={fill} stroke={stroke}
                strokeWidth={b.kind === 'direct' || b.kind === 'source' ? L.fs * 0.1 : L.fs * 0.06} />
              <text x={b.cx} textAnchor="middle" direction="rtl" fill={ink} fontFamily={`"${L.family}", serif`} fontWeight="700" fontSize={L.fs}>
                {b.lines.map((line, i) => <tspan key={i} x={b.cx} y={b.y + L.padY + L.lineH * (i + 0.78)}>{line}</tspan>)}
              </text>
              {b.death && (
                <text x={b.cx} y={b.y + L.padY + L.lineH * b.lines.length + L.deathFs * 0.9} textAnchor="middle" direction="rtl"
                  fill={b.kind === 'me' ? c.paper : c.death} fontFamily={`"${L.family}", serif`} fontSize={L.deathFs}>{death(b.death)}</text>
              )}
              {b.joins > 1 && (
                <g transform={`translate(${b.cx},${b.y + b.h})`}>
                  <circle r={L.fs * 0.48} fill={c.treeJoin} stroke={c.paper} strokeWidth={L.fs * 0.08} />
                  <text y={L.fs * 0.2} textAnchor="middle" fill={c.paper} fontSize={L.fs * 0.58} fontWeight="700" fontFamily="sans-serif">{b.joins}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="tree-legend">
        {[...used].map(k => (
          <span key={k}><i style={{ borderTopColor: c[TX[k].color], borderTopStyle: TX[k].dash ? 'dashed' : 'solid' }} />{TX[k].label}</span>
        ))}
        <span><b style={{ background: c.treeMe }} />أنا وشيوخي المباشرون</span>
        <span><b style={{ background: c.treeSource, borderColor: c.title }} />المصدر</span>
        {hasJoins && <span><em style={{ background: c.treeJoin }}>2</em>نقطة التقاء الطرق (عدد الطرق)</span>}
      </div>
    </div>
  );
}
