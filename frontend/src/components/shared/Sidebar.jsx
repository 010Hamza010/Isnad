import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { section: 'المتون', items: [
    { path: '/mutoon/isnads',      icon: '📚', label: 'أسانيدي' },
    { path: '/mutoon/connections', icon: '🔗', label: 'الاتصالات' },
    { path: '/mutoon/list',        icon: '📗', label: 'قائمة المتون' },
  ]},
  { section: 'القرآن', items: [
    { path: '/quran/isnads',       icon: '📖', label: 'أسانيدي' },
    { path: '/quran/connections',  icon: '🔗', label: 'الاتصالات' },
    { path: '/quran/master',       icon: '⚙️', label: 'القراءات والروايات' },
  ]},
  { section: 'مشترك', items: [
    { path: '/persons',            icon: '👤', label: 'الأشخاص' },
    { path: '/graph',              icon: '🕸', label: 'الشبكة' },
  ]},
];

export default function Sidebar({ stats }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { username, logout } = useAuth();

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div style={{ fontSize: 22 }}>إسناد</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>إدارة الأسانيد والمتون</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {NAV.map(group => (
          <div key={group.section} className="nav-group">
            <div className="sidebar-section">{group.section}</div>
            {group.items.map(item => (
              <button key={item.path}
                className={`nav-item ${loc.pathname === item.path ? 'active' : ''}`}
                onClick={() => nav(item.path)}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-stats">
        {stats && <>
          <div>👤 {stats.persons} شخص</div>
          <div>📗 {stats.mutoon} متن</div>
          <div>🔗 {stats.matnConns} اتصال متون</div>
          <div>📖 {stats.quranConns} اتصال قرآن</div>
        </>}
        <div className="divider" style={{ margin: '10px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13 }}>👤 {username}</span>
          <button className="btn btn-danger btn-sm" onClick={logout} style={{ padding: '3px 10px', fontSize: 12 }}>خروج</button>
        </div>
      </div>
    </div>
  );
}
