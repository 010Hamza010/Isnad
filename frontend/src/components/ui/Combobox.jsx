import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { normalizeArabic } from '../../utils/text';

/**
 * Searchable select. opts: [{ value, label, sub? }]
 * Arabic-aware matching (ignores tashkeel and alef/ya/ta-marbuta variants).
 */
export default function Combobox({ value, opts, onChange, placeholder = 'ابحث واختر…', allowClear = true, invalid }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [hl, setHl]       = useState(0);
  const ref    = useRef(null);
  const listId = useId();

  const current = opts.find(o => String(o.value) === String(value ?? ''));

  // show the selected label whenever value or the option list changes
  useEffect(() => { if (!open) setQuery(current?.label || ''); }, [value, current?.label, open]);

  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q || query === current?.label) return opts;
    return opts.filter(o => normalizeArabic(`${o.label} ${o.sub || ''}`).includes(q));
  }, [opts, query, current?.label]);

  useEffect(() => { setHl(0); }, [query]);

  const pick = o => { onChange(o.value); setQuery(o.label); setOpen(false); };

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHl(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (filtered[hl]) pick(filtered[hl]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpen(false); }
  };

  return (
    <div className="combo" ref={ref}>
      <input
        className={`input${invalid ? ' invalid' : ''}`} value={query} placeholder={placeholder}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={e => { setOpen(true); e.target.select(); }}
        onKeyDown={onKey}
      />
      {allowClear && value !== '' && value != null
        ? <button type="button" className="icon-btn sm combo-btn" aria-label="مسح" title="مسح"
            onClick={() => { onChange(''); setQuery(''); }}><Icon name="x" size={14} /></button>
        : <span className="combo-btn muted" style={{ pointerEvents: 'none', display: 'inline-flex' }}><Icon name="chevDown" size={14} /></span>}
      {open && (
        <div className="combo-list" role="listbox" id={listId}>
          {filtered.length === 0 && <div className="combo-empty">لا نتائج</div>}
          {filtered.slice(0, 200).map((o, i) => (
            <div key={o.value} role="option" aria-selected={String(o.value) === String(value)}
              className={`combo-opt${i === hl ? ' hl' : ''}${String(o.value) === String(value) ? ' sel' : ''}`}
              onMouseEnter={() => setHl(i)} onMouseDown={e => { e.preventDefault(); pick(o); }}>
              <span>{o.label}</span>{o.sub && <span className="sub">{o.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
