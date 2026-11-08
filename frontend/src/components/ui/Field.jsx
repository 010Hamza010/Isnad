import React from 'react';

export function Field({ label, required, hint, children }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}{required && <span className="req">*</span>}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// Bound inputs: read/write `form[name]` through `set(name, value)`.
export const TextInput = ({ form, set, name, ...rest }) => (
  <input className="input" value={form[name] ?? ''} onChange={e => set(name, e.target.value)} {...rest} />
);

export const TextArea = ({ form, set, name, ...rest }) => (
  <textarea className="textarea" value={form[name] ?? ''} onChange={e => set(name, e.target.value)} {...rest} />
);

export const Select = ({ form, set, name, options, placeholder = '— غير محدد —', ...rest }) => (
  <select className="select" value={form[name] ?? ''} onChange={e => set(name, e.target.value)} {...rest}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
