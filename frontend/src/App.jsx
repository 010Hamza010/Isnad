import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/shared/Sidebar';
import Login from './pages/shared/Login';
import Persons from './pages/shared/Persons';
import Graph from './pages/shared/Graph';
import MatnIsnads from './pages/mutoon/MatnIsnads';
import MatnConnections from './pages/mutoon/MatnConnections';
import MatnList from './pages/mutoon/MatnList';
import QuranIsnads from './pages/quran/QuranIsnads';
import QuranConnections from './pages/quran/QuranConnections';
import QuranMasterData from './pages/quran/QuranMasterData';
import api from './utils/api';

const PAGE_TITLES = {
  '/mutoon/isnads': 'أسانيد المتون',
  '/mutoon/connections': 'اتصالات المتون',
  '/mutoon/list': 'قائمة المتون',
  '/quran/isnads': 'أسانيد القرآن',
  '/quran/connections': 'اتصالات القرآن',
  '/quran/master': 'القراءات والروايات والطرق',
  '/persons': 'الأشخاص',
  '/graph': 'الشبكة الكاملة',
};

function Layout() {
  const { isAuth } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const loc = window.location.pathname;

  useEffect(() => {
    if (!isAuth) return;
    Promise.all([
      api.get('/persons'), api.get('/mutoon'),
      api.get('/matn-connections'), api.get('/quran-connections')
    ]).then(([p, m, mc, qc]) => setStats({
      persons: p.data.length, mutoon: m.data.length,
      matnConns: mc.data.length, quranConns: qc.data.length
    })).catch(() => {});
  }, [isAuth, loc]);

  if (!isAuth) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar stats={stats} />
      <div className="main-area">
        <div className="topbar">
          <h1>{PAGE_TITLES[loc] || 'إسناد'}</h1>
        </div>
        <div className="page-content">
          <Routes>
            <Route path="/mutoon/isnads"     element={<MatnIsnads />} />
            <Route path="/mutoon/connections" element={<MatnConnections />} />
            <Route path="/mutoon/list"        element={<MatnList />} />
            <Route path="/quran/isnads"       element={<QuranIsnads />} />
            <Route path="/quran/connections"  element={<QuranConnections />} />
            <Route path="/quran/master"       element={<QuranMasterData />} />
            <Route path="/persons"            element={<Persons />} />
            <Route path="/graph"              element={<Graph />} />
            <Route path="*"                   element={<Navigate to="/mutoon/isnads" replace />} />
          </Routes>
        </div>
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
  return isAuth ? <Navigate to="/mutoon/isnads" replace /> : <Login />;
}
