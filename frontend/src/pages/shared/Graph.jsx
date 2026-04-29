import React, { useEffect, useRef, useState } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import api from '../../utils/api';

export default function Graph() {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [mod, setMod] = useState('both');
  const [tab, setTab] = useState('network');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async (m) => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/graph/full?module=${m}`);
      setData(d);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(mod); }, [mod]);

  useEffect(() => {
    if (!data || tab !== 'network' || !containerRef.current) return;
    if (networkRef.current) networkRef.current.destroy();

    const TX_COLORS = { 'سماع': '#01696f', 'إجازة': '#7c3aed', 'إجازة عامة': '#d97706', 'عرض': '#0369a1', 'قراءة على الشيخ': '#01696f' };

    const nodeMap = new Map();
    nodeMap.set(0, { id: 0, label: 'أنا', color: { background: '#01696f', border: '#01696f' }, font: { color: '#fff', size: 16 }, shape: 'circle', size: 28 });

    data.persons.forEach(p => {
      nodeMap.set(p.id, {
        id: p.id, label: p.name_ar,
        color: { background: '#e0f0ef', border: '#01696f' },
        font: { color: '#01696f', size: 13 },
        title: p.name_ar + (p.region ? ` · ${p.region}` : '')
      });
    });

    const allEdges = [];
    let eid = 1;

    data.matnEdges.forEach(e => {
      allEdges.push({
        id: eid++, from: e.from_person_id, to: e.to_person_id,
        label: e.tx_name || '',
        dashes: !!e.is_general_ijaza,
        color: { color: TX_COLORS[e.tx_name] || '#7a7974' },
        arrows: 'to', font: { size: 10, color: '#7a7974', background: 'white' },
        title: e.matn_title || '',
        physics: true
      });
      [e.from_person_id, e.to_person_id].forEach(id => {
        if (id !== 0 && !nodeMap.has(id)) {
          nodeMap.set(id, { id, label: `#${id}`, color: { background: '#f3f0ec', border: '#dcd9d5' }, font: { color: '#7a7974', size: 12 } });
        }
      });
    });

    data.quranEdges.forEach(e => {
      allEdges.push({
        id: eid++, from: e.from_person_id, to: e.to_person_id,
        label: e.tx_name || '',
        dashes: !!e.is_general,
        color: { color: TX_COLORS[e.tx_name] || '#d97706' },
        arrows: 'to', font: { size: 10, color: '#7a7974', background: 'white' },
        title: e.riwaya_name || '',
        width: 2
      });
      [e.from_person_id, e.to_person_id].forEach(id => {
        if (id !== 0 && !nodeMap.has(id)) {
          nodeMap.set(id, { id, label: `#${id}`, color: { background: '#fffbeb', border: '#d97706' }, font: { color: '#92400e', size: 12 } });
        }
      });
    });

    // Mark persons that only appear in quran
    const quranPersonIds = new Set([...data.quranEdges.map(e => e.from_person_id), ...data.quranEdges.map(e => e.to_person_id)]);
    const matnPersonIds = new Set([...data.matnEdges.map(e => e.from_person_id), ...data.matnEdges.map(e => e.to_person_id)]);
    nodeMap.forEach((node, id) => {
      if (id === 0) return;
      const inQ = quranPersonIds.has(id);
      const inM = matnPersonIds.has(id);
      if (inQ && !inM) { node.color = { background: '#fffbeb', border: '#d97706' }; node.font = { ...node.font, color: '#92400e' }; }
    });

    const nodes = new DataSet([...nodeMap.values()]);
    const edges = new DataSet(allEdges);

    networkRef.current = new Network(containerRef.current, { nodes, edges }, {
      physics: { stabilization: { iterations: 150 }, barnesHut: { gravitationalConstant: -5000, springLength: 120 } },
      interaction: { hover: true, dragNodes: true, zoomView: true, navigationButtons: true },
      edges: { smooth: { type: 'curvedCW', roundness: 0.2 } },
      layout: { improvedLayout: true }
    });
  }, [data, tab]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[['both','الكل'],['mutoon','المتون'],['quran','القرآن']].map(([k,l]) => (
            <button key={k} className={`tab-btn ${mod===k?'active':''}`} onClick={() => setMod(k)}>{l}</button>
          ))}
        </div>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${tab==='network'?'active':''}`} onClick={() => setTab('network')}>🕸 شبكة</button>
          <button className={`tab-btn ${tab==='legend'?'active':''}`} onClick={() => setTab('legend')}>📋 مفتاح</button>
        </div>
        {loading && <span style={{ fontSize: 13, color: 'var(--muted)' }}>⏳ تحميل...</span>}
      </div>

      {tab === 'network' && (
        <>
          <div ref={containerRef} className="graph-wrap" />
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
            <span>🟢 أنا</span>
            <span style={{ color: '#01696f' }}>🔵 علماء المتون</span>
            <span style={{ color: '#d97706' }}>🟡 علماء القرآن</span>
            <span>— خط متصل = سماع/قراءة</span>
            <span>⋯ خط متقطع = إجازة عامة</span>
          </div>
        </>
      )}

      {tab === 'legend' && data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>إحصائيات</div>
            <div style={{ lineHeight: 2.2, fontSize: 14 }}>
              <div>👤 الأشخاص: <strong>{data.persons.length}</strong></div>
              <div>📚 اتصالات المتون: <strong>{data.matnEdges.length}</strong></div>
              <div>📖 اتصالات القرآن: <strong>{data.quranEdges.length}</strong></div>
              <div>🔗 إجمالي الاتصالات: <strong>{data.matnEdges.length + data.quranEdges.length}</strong></div>
            </div>
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>طرق التحمل — الألوان</div>
            {[['#01696f','سماع / قراءة على الشيخ'],['#7c3aed','إجازة'],['#d97706','إجازة عامة'],['#0369a1','عرض']].map(([c,l]) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 3, background: c, borderRadius: 2 }} />
                <span style={{ fontSize: 13 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
