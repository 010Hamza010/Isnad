import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../ui/Icon';
import { NAV } from '../../routes';

const currentTheme = () =>
  document.documentElement.dataset.theme ||
  (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export default function Sidebar({ stats, open }) {
  const { username, logout } = useAuth();
  const [theme, setTheme] = useState(currentTheme);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
    setTheme(next);
  };

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">س</div>
        <div>
          <div className="brand-name">إسناد</div>
          <div className="brand-tag">إدارة الأسانيد والمتون</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.section && <div className="nav-section">{group.section}</div>}
            {group.items.map(item => (
              <NavLink key={item.path} to={item.path} end
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.stat && stats && <span className="count">{stats[item.stat]}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="avatar">{(username || '?').slice(0, 1).toUpperCase()}</div>
        <div className="spacer truncate small strong">{username}</div>
        <button className="icon-btn" onClick={toggleTheme} title="تبديل المظهر" aria-label="تبديل المظهر">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="icon-btn danger" onClick={logout} title="تسجيل الخروج" aria-label="تسجيل الخروج">
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}
