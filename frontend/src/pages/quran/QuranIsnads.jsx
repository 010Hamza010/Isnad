import React, { useEffect, useState, useMemo } from 'react';
import api from '../../utils/api';
import {ChainView, commonSuffix, splitChains} from '../../components/shared/ChainTree';

const MODE_ICON = { 'حضوراً': '🤝', 'عن بُعد': '💻', 'مختلط': '🔀' };

const S = {
  // Layout
  root:   { display:'flex', gap:16, height:'100%', minHeight:0, fontFamily:'inherit' },
  // Sidebar
  sidebar: {
    width:260, flexShrink:0, overflowY:'auto',
    background:'#f8f8f6', borderRadius:10, padding:'12px 10px',
    display:'flex', flexDirection:'column', gap:12,
    border:'1px solid #e5e5e0',
  },
  sidebarTitle: {
    fontSize:12, fontWeight:700, color:'#888', paddingBottom:8,
    borderBottom:'1px solid #e5e5e0', marginBottom:4,
  },
  qiraaHeader: {
    fontSize:11, fontWeight:700, color:'#016f6f',
    padding:'3px 8px', borderRadius:6,
    background:'#e6f4f4', marginBottom:4,
  },
  optionBtn: (active) => ({
    width:'100%', textAlign:'right', padding:'8px 10px',
    marginBottom:3, borderRadius:8,
    border:`1px solid ${active ? '#016f6f' : 'transparent'}`,
    background: active ? '#e6f4f4' : 'transparent',
    color: active ? '#016f6f' : '#222',
    cursor:'pointer', display:'flex', flexDirection:'column', gap:2,
  }),
  optionMain: { fontWeight:600, fontSize:13 },
  optionSub:  { fontSize:11, color:'#999' },
  // Main
  main: { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:14 },
  emptyMain: {
    flex:1, display:'flex', alignItems:'center', justifyContent:'center',
    flexDirection:'column', gap:8, color:'#aaa', fontSize:14,
  },
  // Path header card
  headerCard: {
    background:'#fff', borderRadius:10, padding:'12px 16px',
    display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
    border:'1px solid #e5e5e0', boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  headerTitle:  { fontWeight:700, fontSize:16, color:'#111' },
  headerSub:    { fontSize:12, color:'#888', marginTop:2 },
  badge: (color='#e6f4f4', text='#016f6f') => ({
    fontSize:11, padding:'2px 10px', borderRadius:20,
    background:color, color:text, fontWeight:600,
    border:`1px solid ${color === '#e6f4f4' ? '#b2d8d8' : '#e0e0e0'}`,
  }),
  // Chain card
  chainCard: {
    background:'#fff', borderRadius:10, padding:'14px 16px',
    border:'1px solid #e5e5e0', boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
  },
  chainLabel: { fontSize:11, fontWeight:700, color:'#bbb', marginBottom:14 },
  // Step
  stepRow:    { display:'flex', alignItems:'stretch', gap:12 },
  dotCol:     { display:'flex', flexDirection:'column', alignItems:'center', width:20, flexShrink:0 },
  dot: (gold) => ({
    width:10, height:10, borderRadius:'50%', marginTop:5, flexShrink:0,
    background: gold ? '#d4a017' : '#016f6f',
    boxShadow:  `0 0 0 3px ${gold ? '#fdf3d0' : '#d9f0f0'}`,
  }),
  line: {
    flex:1, width:2, background:'#e5e5e0', minHeight:20, marginTop:2,
  },
  stepContent: (last) => ({ paddingBottom: last ? 0 : 14, flex:1 }),
  fromName:  { fontSize:12, fontWeight:700, color:'#016f6f', marginBottom:2 },
  toName:    (gold) => ({ fontSize:14, fontWeight:600, color: gold ? '#c8870a' : '#111' }),
  scopeRow:  { display:'flex', gap:6, flexWrap:'wrap', marginTop:4 },
  desc:      { fontSize:11, color:'#aaa', marginTop:2, fontStyle:'italic' },
};

export default function QuranIsnads() {
  const [conns, setConns]       = useState([]);
  const [qiraat, setQiraat]     = useState([]);
  const [riwayat, setRiwayat]   = useState([]);
  const [turuq, setTuruq]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [pathData, setPathData] = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/quran-connections'),
      api.get('/quran/qiraat'),
      api.get('/quran/riwayat'),
      api.get('/quran/turuq'),
    ]).then(([c, q, r, t]) => {
      setConns(c.data); setQiraat(q.data); setRiwayat(r.data); setTuruq(t.data);
    });
  }, []);

  const qMap = useMemo(() => new Map(qiraat.map(q  => [Number(q.id),  q])),  [qiraat]);
  const rMap = useMemo(() => new Map(riwayat.map(r => [Number(r.id),  r])),  [riwayat]);
  const tMap = useMemo(() => new Map(turuq.map(t   => [Number(t.id),  t])),  [turuq]);

  const resolveItem = (it) => {
    const riwaya     = it.riwaya_id ? rMap.get(Number(it.riwaya_id)) : null;
    const qiraa      = it.qiraa_id  ? qMap.get(Number(it.qiraa_id))  : null;
    const tariq      = it.tariq_id  ? tMap.get(Number(it.tariq_id))  : null;
    const qiraaFromR = riwaya ? qMap.get(Number(riwaya.qiraa_id))    : null;
    const resolvedQ  = qiraaFromR || qiraa;
    return {
      riwaya_id:   it.riwaya_id || null,
      tariq_id:    it.tariq_id  || null,
      qiraa_id:    riwaya?.qiraa_id || it.qiraa_id || null,
      qiraaLabel:  resolvedQ?.name_ar  || 'غير محدد',
      riwayaLabel: riwaya?.name_ar     || null,
      tariqLabel:  tariq?.name_ar      || null,
    };
  };

  const sidebarGroups = useMemo(() => {
    const myConns = conns.filter(c => Number(c.from_person_id) === 0);
    const seen = new Map();
    myConns.forEach(conn => {
      if (!conn.items?.length) {
        const key = 'mutlaq';
        if (!seen.has(key))
          seen.set(key, { key, riwaya_id:null, tariq_id:null, qiraa_id:null,
            qiraaLabel:'مطلق', riwayaLabel:null, tariqLabel:null, teacher:conn.to_name });
      } else {
        conn.items.forEach(it => {
          const r   = resolveItem(it);
          const key = `q${r.qiraa_id}-r${r.riwaya_id}-t${r.tariq_id}`;
          if (!seen.has(key)) seen.set(key, { key, ...r, teacher: conn.to_name });
        });
      }
    });
    const grouped = new Map();
    seen.forEach(opt => {
      if (!grouped.has(opt.qiraaLabel)) grouped.set(opt.qiraaLabel, []);
      grouped.get(opt.qiraaLabel).push(opt);
    });
    return [...grouped.entries()];
  }, [conns, qiraat, riwayat, turuq]);

  const loadPath = async (opt) => {
    setSelected(opt); setLoading(true); setPathData(null);
    try {
      const params = new URLSearchParams();
      if (opt.riwaya_id) params.append('riwaya_id', opt.riwaya_id);
      if (opt.tariq_id)  params.append('tariq_id',  opt.tariq_id);
      // if no riwaya, send qiraa_id so backend can find the imam target
      if (!opt.riwaya_id && opt.qiraa_id) params.append('qiraa_id', opt.qiraa_id);
      const { data } = await api.get(`/graph/quran/paths?${params}`);
      setPathData(data);
    } finally { setLoading(false); }
  };

  const stepScope = (edge) => {
    if (!edge.items?.length) return null;
    return edge.items.map(it => {
      const r    = it.riwaya_id ? rMap.get(Number(it.riwaya_id)) : null;
      const q    = it.qiraa_id  ? qMap.get(Number(it.qiraa_id))  : null;
      const t    = it.tariq_id  ? tMap.get(Number(it.tariq_id))  : null;
      const qFR  = r ? qMap.get(Number(r.qiraa_id)) : null;
      return [(qFR || q)?.name_ar, r?.name_ar, t?.name_ar].filter(Boolean).join(' · ');
    }).filter(Boolean).join('، ') || null;
  };

  return (
    <div style={S.root}>

      {/* ── Sidebar ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarTitle}>سنداتي القرآنية</div>

        {sidebarGroups.length === 0 && (
          <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:20 }}>
            لا يوجد سند بعد
          </div>
        )}

        {sidebarGroups.map(([qiraaLabel, options]) => (
          <div key={qiraaLabel}>
            <div style={S.qiraaHeader}>{qiraaLabel}</div>
            {options.map(opt => {
              const active     = selected?.key === opt.key;
              const mainLabel  = opt.riwayaLabel || opt.qiraaLabel;
              return (
                <button key={opt.key} onClick={() => loadPath(opt)} style={S.optionBtn(active)}>
                  <span style={S.optionMain}>{mainLabel}</span>
                  {opt.tariqLabel && (
                    <span style={S.optionSub}>طريق: {opt.tariqLabel}</span>
                  )}
                  <span style={S.optionSub}>عن: {opt.teacher}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Main ── */}
      <div style={S.main}>

        {!selected && !loading && (
          <div style={S.emptyMain}>
            <span style={{ fontSize:40 }}>📖</span>
            <span>اختر رواية من القائمة لعرض السند</span>
          </div>
        )}

        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:14 }}>
            جار تحميل السند...
          </div>
        )}

        {pathData && !loading && (
          <>
            {/* Header */}
            <div style={S.headerCard}>
              <div style={{ flex:1 }}>
                <div style={S.headerTitle}>
                  {selected.riwayaLabel || selected.qiraaLabel}
                </div>
                {pathData.riwaya && (
                  <div style={S.headerSub}>
                    {[
                      pathData.riwaya.qiraa_name,
                      pathData.riwaya.imam_name && `إمام: ${pathData.riwaya.imam_name}`,
                      pathData.riwaya.rawi_name  && `راوٍ: ${pathData.riwaya.rawi_name}`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <span style={S.badge('#f0f0ee', '#666')}>
                {pathData.paths.length} مسار
              </span>
            </div>

            {pathData.paths.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>
                لم يُعثر على مسار كامل — تأكد من اكتمال السلسلة حتى الإمام
              </div>
            )}

            {pathData.paths.map((group, gi) => (
                <div key={gi} style={S.chainCard}>
                  <div style={S.chainLabel}>عن: {group.firstEdge.to_name}</div>

                  {/* أنا → شيخ */}
                  <div style={S.stepRow}>
                    <div style={S.dotCol}>
                      <div style={S.dot(false)} />
                      <div style={S.line} />
                    </div>
                    <div style={{ paddingBottom: 12, flex: 1 }}>
                      <div style={S.fromName}>أنا</div>
                      <div style={S.toName(false)}>{group.firstEdge.to_name}</div>
                      <div style={S.scopeRow}>
                        {group.firstEdge.tx_name && <span style={S.badge('#f0f0ee','#777')}>{group.firstEdge.tx_name}</span>}
                        {stepScope(group.firstEdge) && <span style={S.badge('#e6f4f4','#016f6f')}>{stepScope(group.firstEdge)}</span>}
                      </div>
                    </div>
                  </div>

                  <ChainView
                    chains={group.chains}
                    stepScope={stepScope}
                    S={S}
                  />
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}