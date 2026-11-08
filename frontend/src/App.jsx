import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/shared/Sidebar';
import Icon from './components/ui/Icon';
import Login from './pages/shared/Login';
import Home from './pages/shared/Home';
import Persons from './pages/shared/Persons';
import MatnIsnads from './pages/mutoon/MatnIsnads';
import MatnConnections from './pages/mutoon/MatnConnections';
import MatnList from './pages/mutoon/MatnList';
import QuranIsnads from './pages/quran/QuranIsnads';
import QuranConnections from './pages/quran/QuranConnections';
import QuranMasterData from './pages/quran/QuranMasterData';
import Settings from './pages/shared/Settings';
import Ijazat from './pages/ijazat/Ijazat';
import { routeMeta } from './routes';
import api from './utils/api';

// vis-network is ~500 kB — load it only when the graph page is opened
const Graph = lazy(() => import('./pages/shared/Graph'));

function Layout() {
  const { isAuth } = useAuth();
  const { pathname } = useLocation();
  const [stats, setStats] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const meta = routeMeta(pathname);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isAuth) return;
    Promise.all([
      api.get('/persons'), api.get('/mutoon'),
      api.get('/matn-connections'), api.get('/quran-connections'),
    ]).then(([p, m, mc, qc]) => setStats({
      persons: p.data.length, mutoon: m.data.length,
      matnConns: mc.data.length, quranConns: qc.data.length,
    })).catch(() => {});
  }, [isAuth, pathname]);

  if (!isAuth) return <Navigate to="/login" replace />;

  return (
    <div className="app">
      <Sidebar stats={stats} open={navOpen} />
      <div className={`sidebar-backdrop${navOpen ? ' open' : ''}`} onClick={() => setNavOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="القائمة">
            <Icon name="menu" />
          </button>
          <div>
            <div className="topbar-title">{meta?.title || 'إسناد'}</div>
            {meta?.sub && <div className="topbar-sub">{meta.sub}</div>}
          </div>
        </header>
        <main className="content">
          <div className="content-inner">
            <Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>
            <Routes>
              <Route path="/"                   element={<Home stats={stats} />} />
              <Route path="/mutoon/isnads"      element={<MatnIsnads />} />
              <Route path="/mutoon/connections" element={<MatnConnections />} />
              <Route path="/mutoon/list"        element={<MatnList />} />
              <Route path="/quran/isnads"       element={<QuranIsnads />} />
              <Route path="/quran/connections"  element={<QuranConnections />} />
              <Route path="/quran/master"       element={<QuranMasterData />} />
              <Route path="/persons"            element={<Persons />} />
              <Route path="/graph"              element={<Graph />} />
              <Route path="/settings"           element={<Settings />} />
              <Route path="/ijazat"             element={<Ijazat />} />
              <Route path="*"                   element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginGuard />} />
        <Route path="/*" element={<Layout />} />
      </Routes>
    </AuthProvider>
  );
}

function LoginGuard() {
  const { isAuth } = useAuth();
  return isAuth ? <Navigate to="/" replace /> : <Login />;
}
