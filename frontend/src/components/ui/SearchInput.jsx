import React from 'react';
import Icon from './Icon';

export default function SearchInput({ value, onChange, placeholder = 'بحث…', className = '' }) {
  return (
    <div className={`input-icon ${className}`}>
      <Icon name="search" size={16} />
      <input className="input" type="search" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}
