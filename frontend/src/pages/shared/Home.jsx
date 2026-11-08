import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/ui/Icon';

const STATS = [
  { key: 'persons',    label: 'علَم',          icon: 'users', to: '/persons',            tone: 'primary' },
  { key: 'mutoon',     label: 'متن',           icon: 'books', to: '/mutoon/list',        tone: 'accent' },
  { key: 'matnConns',  label: 'اتصال بالمتون', icon: 'link',  to: '/mutoon/connections', tone: 'info' },
  { key: 'quranConns', label: 'اتصال قرآني',   icon: 'quran', to: '/quran/connections',  tone: 'purple' },
];

const STEPS = [
  { n: 1, title: 'أضف الأعلام', text: 'شيوخك ومن فوقهم، والمؤلفين وأئمة القراءات.', to: '/persons' },
  { n: 2, title: 'سجّل الاتصالات المباشرة', text: 'من قرأتَ عليه، ومن قرأ هو عليه… حلقة حلقة فقط.', to: '/mutoon/connections' },
  { n: 3, title: 'شاهد أسانيدك كاملة', text: 'يبني التطبيق السلاسل تلقائياً حتى المؤلف أو حتى النبي ﷺ.', to: '/mutoon/isnads' },
];

export default function Home({ stats }) {
  const { username } = useAuth();
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="hero">
        <div className="hero-sub">السلام عليكم</div>
        <div className="hero-title">{username}</div>
        <div className="row row-wrap" style={{ marginTop: 14 }}>
          <Link to="/mutoon/isnads" className="btn" style={{ background: 'var(--accent-soft)', color: '#3a2f17' }}>
            <Icon name="chain" size={16} /> أسانيد المتون
          </Link>
          <Link to="/quran/isnads" className="btn" style={{ background: 'rgba(255,255,255,.14)', color: 'inherit' }}>
            <Icon name="quran" size={16} /> أسانيد القرآن
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        {STATS.map(s => (
          <Link key={s.key} to={s.to} className="card stat">
            <div className="stat-icon" style={{ background: `var(--${s.tone}-soft)`, color: `var(--${s.tone})` }}>
              <Icon name={s.icon} size={22} />
            </div>
            <div>
              <div className="stat-value">{stats ? stats[s.key] : <span className="skeleton" style={{ display: 'inline-block', width: 40, height: 22 }} />}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">كيف يعمل إسناد؟</div></div>
        <div className="grid grid-3 card-pad">
          {STEPS.map(s => (
            <Link key={s.n} to={s.to} style={{ textDecoration: 'none', color: 'inherit' }} className="row" >
              <div style={{ alignSelf: 'flex-start' }} className="avatar">{s.n}</div>
              <div>
                <div className="strong">{s.title}</div>
                <div className="small muted">{s.text}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
