import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import Segmented from '../../components/ui/Segmented';
import Combobox from '../../components/ui/Combobox';
import Icon from '../../components/ui/Icon';

const SACRED = { [-1]: 'النبي ﷺ', [-2]: 'جبريل عليه السلام', [-3]: 'رب العزة' };

// read design tokens so the graph follows light/dark theme
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function Graph() {
  const containerRef = useRef(null);
  const networkRef   = useRef(null);
  const [mod, setMod]     = useState('both');
  const [focus, setFocus] = useState('');
  const { data, loading } = useLoad(() => api.get(`/graph/full?module=${mod}`).then(r => r.data), [mod]);

  const nodeOpts = useMemo(() => {
    if (!data) return [];
    const used = new Set([...data.matnEdges, ...data.quranEdges].flatMap(e => [e.from_person_id, e.to_person_id]));
    return data.persons.filter(p => used.has(p.id)).map(p => ({ value: p.id, label: p.name_ar }));
  }, [data]);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    networkRef.current?.destroy();

    const c = {
      primary: token('--primary'), primarySoft: token('--primary-soft'),
      accent: token('--accent'), accentSoft: token('--accent-soft'),
      text: token('--text'), muted: token('--muted'), surface: token('--surface'), border: token('--border-strong'),
      purple: token('--purple'), info: token('--info'),
    };
    const txColor = name => ({ 'سماع': c.primary, 'قراءة على الشيخ': c.primary, 'إجازة': c.purple, 'إجازة عامة': c.accent, 'عرض': c.info }[name] || c.muted);
    const font = { face: 'IBM Plex Sans Arabic, sans-serif', size: 14, color: c.text };

    const quranIds = new Set(data.quranEdges.flatMap(e => [e.from_person_id, e.to_person_id]));
    const matnIds  = new Set(data.matnEdges.flatMap(e => [e.from_person_id, e.to_person_id]));
    const nodes = new Map();
    nodes.set(0, { id: 0, label: 'أنا', shape: 'circle', color: { background: c.primary, border: c.primary }, font: { ...font, color: c.surface, size: 16, bold: true }, margin: 14 });
    Object.entries(SACRED).forEach(([id, label]) => {
      if (quranIds.has(Number(id))) nodes.set(Number(id), { id: Number(id), label, shape: 'box', color: { background: c.accentSoft, border: c.accent }, font: { ...font, color: c.accent, size: 15 }, margin: 10 });
    });
    data.persons.forEach(p => {
      if (!quranIds.has(p.id) && !matnIds.has(p.id)) return; // only people in the network
      const quranOnly = quranIds.has(p.id) && !matnIds.has(p.id);
      nodes.set(p.id, {
        id: p.id, label: p.name_ar, shape: 'box', margin: 8,
        title: p.name_ar + (p.region ? ` · ${p.region}` : ''),
        color: { background: quranOnly ? c.accentSoft : c.primarySoft, border: quranOnly ? c.accent : c.primary,
                 highlight: { background: c.surface, border: c.text } },
        font: { ...font, color: quranOnly ? c.accent : c.primary },
      });
    });

    let eid = 1;
    const edges = [
      ...data.matnEdges.map(e => ({ id: eid++, from: e.from_person_id, to: e.to_person_id, dashes: !!e.is_general_ijaza,
        color: { color: txColor(e.tx_name), opacity: .8 }, title: [e.tx_name, e.matn_title].filter(Boolean).join(' · ') || undefined })),
      ...data.quranEdges.map(e => ({ id: eid++, from: e.from_person_id, to: e.to_person_id, width: 2,
        color: { color: e.tx_name ? txColor(e.tx_name) : c.accent, opacity: .8 }, title: e.tx_name || undefined })),
    ].filter(e => nodes.has(e.from) && nodes.has(e.to));

    networkRef.current = new Network(containerRef.current, { nodes: new DataSet([...nodes.values()]), edges: new DataSet(edges) }, {
      layout: { hierarchical: { enabled: true, direction: 'UD', sortMethod: 'directed', levelSeparation: 110, nodeSpacing: 170 } },
      physics: false,
      interaction: { hover: true, navigationButtons: false, keyboard: true, tooltipDelay: 150 },
      edges: { arrows: { to: { enabled: true, scaleFactor: .6 } }, smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: .4 } },
      nodes: { borderWidth: 1.5, shapeProperties: { borderRadius: 8 } },
    });
    return () => { networkRef.current?.destroy(); networkRef.current = null; };
  }, [data]);

  useEffect(() => {
    if (!focus || !networkRef.current) return;
    networkRef.current.selectNodes([Number(focus)]);
    networkRef.current.focus(Number(focus), { scale: 1.2, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
  }, [focus]);

  const fit = () => networkRef.current?.fit({ animation: { duration: 400 } });

  return (
    <>
      <div className="toolbar">
        <Segmented value={mod} onChange={v => { setMod(v); setFocus(''); }} options={[
          { value: 'both', label: 'الكل' }, { value: 'mutoon', label: 'المتون' }, { value: 'quran', label: 'القرآن' },
        ]} />
        <div style={{ minWidth: 240, flex: '0 1 300px' }}>
          <Combobox value={focus} opts={nodeOpts} onChange={setFocus} placeholder="انتقل إلى علَم…" />
        </div>
        <div className="spacer" />
        {loading && <span className="spinner muted" />}
        {data && <span className="small muted">{data.matnEdges.length + data.quranEdges.length} اتصالاً</span>}
        <button className="btn btn-secondary btn-sm" onClick={fit}><Icon name="network" size={15} /> عرض الكل</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div ref={containerRef} className="graph-canvas" />
        <div className="legend">
          <span><i className="dot" style={{ background: 'var(--primary)' }} />علماء المتون</span>
          <span><i className="dot" style={{ background: 'var(--accent)' }} />القرّاء</span>
          <span><i style={{ background: 'var(--primary)' }} />سماع / قراءة</span>
          <span><i style={{ background: 'var(--purple)' }} />إجازة</span>
          <span><i style={{ background: 'var(--info)' }} />عرض</span>
          <span><i style={{ background: 'repeating-linear-gradient(90deg, var(--accent) 0 4px, transparent 4px 7px)' }} />إجازة عامة</span>
        </div>
      </div>
    </>
  );
}
