import React, { Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/ui/Icon';
import useLoad from '../../hooks/useLoad';
import api from '../../utils/api';
import { wasaitText } from '../../utils/isnadSky';

// three.js is large: the sky is its own chunk, loaded after the page shows
const IsnadSky = lazy(() => import('../../components/home/IsnadSky'));

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

const MAX_ROWS = 6;

/** One list of «أعلى أسانيدك»: the shorter the bar, the higher the isnad. */
function HeightList({ title, icon, rows, target, linkOf }) {
  if (!rows.length) return null;
  const most = Math.max(...rows.map(r => r.wasait), 1);
  return (
    <div className="heights-col">
      <div className="heights-head"><Icon name={icon} size={16} /> {title}</div>
      {rows.slice(0, MAX_ROWS).map((r, i) => (
        <Link key={r.id ?? r.riwaya_id ?? `q${r.qiraa_id}`} to={linkOf(r)} className={`height-row${i === 0 ? ' best' : ''}`}>
          <div className="height-text">
            <div className="height-name">{r.label}</div>
            <div className="small muted">{wasaitText(r.wasait)} {target(r)}{r.routes > 1 ? ` · ${r.routes} طرق` : ''}</div>
          </div>
          <div className="height-bar" title={wasaitText(r.wasait)}>
            <span style={{ inlineSize: `${Math.max(6, (r.wasait / most) * 100)}%` }} />
          </div>
          <div className="height-n">{r.wasait}</div>
        </Link>
      ))}
      {rows.length > MAX_ROWS && <div className="small muted heights-more">و{rows.length - MAX_ROWS} أخرى</div>}
    </div>
  );
}

export default function Home({ stats }) {
  const { username } = useAuth();
  const navigate = useNavigate();
  const { data: graph } = useLoad(() => api.get('/graph/full').then(r => r.data), []);
  const { data: heights } = useLoad(() => api.get('/graph/heights').then(r => r.data), []);
  const hasHeights = heights && (heights.mutoon.length || heights.quran.length);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="hero hero-sky">
        {graph && (
          <Suspense fallback={null}>
            <IsnadSky data={graph} onPick={p => navigate(`/graph?focus=${p.id}`)} />
          </Suspense>
        )}
        <div className="hero-sky-text">
          <div className="hero-sub">السلام عليكم</div>
          <div className="hero-title">{username}</div>
          <p className="hero-sky-caption">سماء إسنادك: أنت في الأسفل، وكل خيط نورٍ اتصالٌ يصعد بك إلى شيوخك ومَن فوقهم.</p>
          <div className="row row-wrap" style={{ marginTop: 14 }}>
            <Link to="/mutoon/isnads" className="btn" style={{ background: 'var(--accent-soft)', color: '#3a2f17' }}>
              <Icon name="chain" size={16} /> أسانيد المتون
            </Link>
            <Link to="/quran/isnads" className="btn" style={{ background: 'rgba(255,255,255,.14)', color: 'inherit' }}>
              <Icon name="quran" size={16} /> أسانيد القرآن
            </Link>
          </div>
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

      {hasHeights ? (
        <div className="card">
          <div className="card-head">
            <div className="card-title">أعلى أسانيدك</div>
            <div className="small muted">أقلّ الوسائط بينك وبين المؤلف أو النبي ﷺ — الأقصر أعلى</div>
          </div>
          <div className="heights card-pad">
            <HeightList title="القرآن الكريم" icon="quran" rows={heights.quran}
              target={() => 'إلى النبي ﷺ'} linkOf={() => '/quran/isnads'} />
            <HeightList title="المتون" icon="books" rows={heights.mutoon}
              target={r => (r.author_name ? `إلى ${r.author_name}` : '')} linkOf={r => `/mutoon/isnads?matn=${r.id}`} />
          </div>
        </div>
      ) : null}

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
