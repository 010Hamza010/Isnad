import React, { useState } from 'react';
import Icon from './Icon';

/** Editable list of short strings: Enter or «،» adds, Backspace on empty removes the last. */
export default function TagInput({ value = [], onChange, placeholder = 'أضف…' }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const parts = draft.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };

  const onKey = e => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '،') { e.preventDefault(); add(); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };

  return (
    <div className="tag-input" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
      {value.map(v => (
        <span key={v} className="tag">{v}
          <button type="button" aria-label={`حذف ${v}`} onClick={() => onChange(value.filter(x => x !== v))}><Icon name="x" size={12} /></button>
        </span>
      ))}
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add}
        placeholder={value.length ? '' : placeholder} />
    </div>
  );
}
