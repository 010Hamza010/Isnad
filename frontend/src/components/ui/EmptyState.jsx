import React from 'react';
import Icon from './Icon';

export default function EmptyState({ icon = 'search', title, subtitle, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      {title && <div className="empty-title">{title}</div>}
      {subtitle && <div className="small">{subtitle}</div>}
      {action}
    </div>
  );
}

export const SkeletonList = ({ rows = 5 }) => (
  <div className="list">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="list-item">
        <div className="list-main stack" style={{ gap: 6 }}>
          <div className="skeleton" style={{ height: 14, width: `${40 + (i * 13) % 35}%` }} />
          <div className="skeleton" style={{ height: 11, width: '25%' }} />
        </div>
      </div>
    ))}
  </div>
);
