import React from 'react';
import { Field } from '../ui/Field';

/**
 * Title colour / font / size. Empty values follow the design (shown as the placeholder).
 * value: { color, family, size }; design: the design whose values apply when empty.
 */
export default function TitleStyleFields({ value = {}, onChange, options, design }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const [min, max] = options?.fontSizes?.title || [16, 60];
  const def = design?.fonts?.title;
  return (
    <div className="form-grid">
      <Field label="لون العنوان" hint={value.color ? undefined : 'من التصميم'}>
        <div className="row">
          <input type="color" className="color-input" value={value.color || design?.colors?.title || '#000000'} onChange={e => set('color', e.target.value)} />
          {value.color && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('color', '')}>كما في التصميم</button>}
        </div>
      </Field>
      <Field label="خط العنوان">
        <select className="select" value={value.family || ''} onChange={e => set('family', e.target.value)}
          style={{ fontFamily: `"${value.family || def?.family}"` }}>
          <option value="">كما في التصميم{def ? ` (${def.family})` : ''}</option>
          {(options?.fonts || []).map(f => <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>)}
        </select>
      </Field>
      <Field label="حجم العنوان (pt)">
        <input className="input" type="number" min={min} max={max} step="1" value={value.size ?? ''} placeholder={def ? String(def.size) : ''}
          onChange={e => set('size', e.target.value === '' ? null : Number(e.target.value))} />
      </Field>
    </div>
  );
}
