import React from 'react';
export default function PersonSelect({ value, onChange, persons, includeMe = true, label = 'الشخص' }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— اختر —</option>
        {includeMe && <option value="0">أنا</option>}
        {persons.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
      </select>
    </div>
  );
}
