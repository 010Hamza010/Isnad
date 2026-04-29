import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { ChainView } from '../../components/shared/ChainTree';
import EmptyState from '../../components/shared/EmptyState';

const S = {
  stepRow:    { display:'flex', alignItems:'stretch', gap:12 },
  dotCol:     { display:'flex', flexDirection:'column', alignItems:'center', width:20, flexShrink:0 },
  dot: (gold) => ({
    width:10, height:10, borderRadius:'50%', marginTop:5, flexShrink:0,
    background: gold ? '#d4a017' : '#016f6f',
    boxShadow: `0 0 0 3px ${gold ? '#fdf3d0' : '#d9f0f0'}`,
  }),
  line:       { flex:1, width:2, background:'#e5e5e0', minHeight:20, marginTop:2 },
  stepContent:(last) => ({ paddingBottom: last ? 0 : 12, flex:1 }),
  toName:     (gold) => ({ fontSize:14, fontWeight:600, color: gold ? '#c8870a' : '#111' }),
  fromName:   { fontSize:12, fontWeight:700, color:'#016f6f', marginBottom:2 },
  scopeRow:   { display:'flex', gap:6, flexWrap:'wrap', marginTop:4 },
  badge:      (bg, color) => ({
    fontSize:11, padding:'1px 7px', borderRadius:20,
    background:bg, color, fontWeight:500,
  }),
  desc:       { fontSize:11, color:'#aaa', marginTop:2, fontStyle:'italic' },
};

export default function MatnIsnads() {
  const [mutoon, setMutoon]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [paths, setPaths]       = useState([]);
  const [matnInfo, setMatnInfo] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState('');
  const [searched, setSearched] = useState('');

  useEffect(() => { api.get('/mutoon?connected=1').then(r => setMutoon(r.data)); }, []);

  const loadPaths = async id => {
    setSelected(id); setLoading(true);
    try {
      const { data } = await api.get(`/graph/matn/${id}/paths`);
      setPaths(data.paths);
      setMatnInfo(data.matn);
    } finally { setLoading(false); }
  };

  const subjects = [...new Set(mutoon.map(m => m.subject).filter(Boolean))].sort();
  const filtered = mutoon.filter(m =>
    (!filter  || m.subject === filter) &&
    (!searched || m.title.toLowerCase().includes(searched.toLowerCase()) ||
                  (m.author_name||'').toLowerCase().includes(searched.toLowerCase()))
  );

  return (
    <div style={{ display:'flex', gap:16, height:'100%', minHeight:0 }}>

      {/* ── Sidebar ── */}
      <div style={{
        width:260, flexShrink:0, overflowY:'auto',
        background:'#f8f8f6', borderRadius:10, padding:'12px 10px',
        display:'flex', flexDirection:'column', gap:10,
        border:'1px solid #e5e5e0',
      }}>
        <input
          className="form-input"
          placeholder="بحث في المتون..."
          value={searched}
          onChange={e => setSearched(e.target.value)}
          style={{ marginBottom:4 }}
        />

        {/* subject filter */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:4 }}>
          <button onClick={() => setFilter('')} style={{
            fontSize:11, padding:'2px 8px', borderRadius:20, cursor:'pointer',
            background: !filter ? '#016f6f' : '#f0f0ee',
            color: !filter ? '#fff' : '#555',
            border: 'none',
          }}>الكل</button>
          {subjects.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              fontSize:11, padding:'2px 8px', borderRadius:20, cursor:'pointer',
              background: filter === s ? '#016f6f' : '#f0f0ee',
              color: filter === s ? '#fff' : '#555',
              border:'none',
            }}>{s}</button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:16 }}>لا توجد نتائج</div>
        )}

        {filtered.map(m => (
          <button key={m.id} onClick={() => loadPaths(m.id)} style={{
            width:'100%', textAlign:'right', padding:'8px 10px',
            borderRadius:8, cursor:'pointer',
            border:`1px solid ${selected === m.id ? '#016f6f' : 'transparent'}`,
            background: selected === m.id ? '#e6f4f4' : 'transparent',
            color: selected === m.id ? '#016f6f' : '#222',
            display:'flex', flexDirection:'column', gap:2,
          }}>
            <span style={{ fontWeight:600, fontSize:13 }}>{m.title}</span>
            {m.author_name && <span style={{ fontSize:11, color:'#999' }}>{m.author_name}</span>}
            {m.subject     && <span style={{ fontSize:10, color:'#bbb' }}>{m.subject}</span>}
          </button>
        ))}
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>

        {!selected && !loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#aaa', fontSize:14 }}>
            <span style={{ fontSize:40 }}>📚</span>
            <span>اختر متناً من القائمة لعرض السند</span>
          </div>
        )}

        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:14 }}>جار تحميل السند...</div>
        )}

        {!loading && selected && matnInfo && (
          <div style={{
            background:'#fff', borderRadius:10, padding:'12px 16px',
            border:'1px solid #e5e5e0', boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
            display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>{matnInfo.title}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
                {[matnInfo.author_name, matnInfo.subject].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span style={{ fontSize:11, padding:'2px 10px', borderRadius:20, background:'#f0f0ee', color:'#666' }}>
              {paths.length} {paths.length === 1 ? 'سند' : 'أسانيد'}
            </span>
          </div>
        )}

        {!loading && selected && paths.length === 0 && (
          <EmptyState icon="📖" title="لا يوجد سند" subtitle="لم يُعثر على مسار كامل لهذا المتن" />
        )}

        {paths.map((group, gi) => (
          <div key={gi} style={{
            background:'#fff', borderRadius:10, padding:'14px 16px',
            border:'1px solid #e5e5e0', boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#bbb', marginBottom:14 }}>
              عن: {group.firstEdge.to_name}
            </div>

            {/* أنا → شيخ */}
            <div style={S.stepRow}>
              <div style={S.dotCol}>
                <div style={S.dot(false)} />
                <div style={S.line} />
              </div>
              <div style={{ paddingBottom:12, flex:1 }}>
                <div style={S.fromName}>أنا</div>
                <div style={S.toName(false)}>{group.firstEdge.to_name}</div>
                <div style={S.scopeRow}>
                  {group.firstEdge.tx_name && (
                    <span style={S.badge('#f0f0ee','#777')}>{group.firstEdge.tx_name}</span>
                  )}
                </div>
                {group.firstEdge.description && (
                  <div style={S.desc}>{group.firstEdge.description}</div>
                )}
              </div>
            </div>

            {/* upper chain as tree */}
            <ChainView
              chains={group.chains}
              stepScope={() => null}
              S={S}
              authorId={matnInfo?.author_id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}