import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, { username, password });
      if (mode === 'register') { setMode('login'); setLoading(false); return; }
      login(data.token, data.username);
      nav('/mutoon');
    } catch (e) { setErr(e.response?.data?.error || 'خطأ'); setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 36, width: 380, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginBottom: 6, textAlign: 'center' }}>إسناد</div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>إدارة الأسانيد والمتون</div>
        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label">اسم المستخدم</label>
            <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} required /></div>
          <div className="form-group"><label className="form-label">كلمة المرور</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {err && <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
          <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'إنشاء حساب جديد' : 'لديّ حساب'}
          </button>
        </form>
      </div>
    </div>
  );
}
