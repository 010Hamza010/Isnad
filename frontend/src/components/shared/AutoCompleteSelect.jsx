import React, { useState, useEffect, useRef } from 'react';

export default function AutoCompleteSelect({ label, value, opts, placeholder = '—', onChange }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const ref               = useRef(null);

  const currentOpt = opts.find(o => String(o.value) === String(value || ''));

  useEffect(() => {
    setQuery(currentOpt?.label || '');
  }, [value]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim() === '' || query === currentOpt?.label
    ? opts
    : opts.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) || o.label.includes(query)
      );

  const select = (o) => {
    setQuery(o.label);
    setOpen(false);
    onChange && onChange(o.value);
  };

  const clear = () => {
    setQuery('');
    setOpen(false);
    onChange && onChange('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{ paddingLeft: 28, width: '100%' }}
        />
        {value
          ? <button onClick={clear} style={{
              position:'absolute', left:6, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', cursor:'pointer',
              color:'#aaa', fontSize:14, lineHeight:1, padding:0,
            }}>✕</button>
          : <span style={{
              position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
              color:'#aaa', fontSize:11, pointerEvents:'none',
            }}>▾</span>
        }
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position:'absolute', zIndex:999, top:'100%', left:0, right:0,
          background:'#fff', border:'1px solid #ddd', borderRadius:6,
          boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
          maxHeight:220, overflowY:'auto', marginTop:2,
        }}>
          {filtered.map(o => {
            const active = String(value) === String(o.value);
            return (
              <div
                key={o.value}
                onMouseDown={() => select(o)}
                style={{
                  padding:'8px 12px', cursor:'pointer', fontSize:13,
                  background: active ? '#e6f4f4' : 'transparent',
                  color:      active ? '#016f6f' : '#222',
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f5f3'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}