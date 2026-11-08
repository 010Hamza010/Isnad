import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../components/ui/UIProvider';
import api from '../../utils/api';

const ChainArt = () => (
  <svg className="chainviz" width="360" height="360" viewBox="0 0 360 360" fill="none" stroke="currentColor" strokeWidth="2">
    {[[60, 300], [140, 220], [220, 260], [180, 140], [260, 120], [300, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="14" />)}
    <path d="M70 290 130 230M150 225 210 255M147 208 175 155M192 132 248 124M266 107 292 54" />
  </svg>
);

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async e => {
    e.preventDefault(); setErr(''); setNotice(''); setLoading(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, { username, password });
      if (mode === 'register') {
        setMode('login'); setPassword(''); setNotice('تم إنشاء الحساب، سجّل الدخول الآن');
        return;
      }
      login(data.token, data.username);
      nav('/');
    } catch (e) {
      setErr(e.response?.status === 401 ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : errorMessage(e));
    } finally { setLoading(false); }
  };

  const isLogin = mode === 'login';

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-card">
          <div className="brand" style={{ padding: 0, marginBottom: 28 }}>
            <div className="brand-mark">س</div>
            <div><div className="brand-name">إسناد</div><div className="brand-tag">إدارة الأسانيد والمتون</div></div>
          </div>
          <h1>{isLogin ? 'مرحباً بعودتك' : 'إنشاء حساب'}</h1>
          <p className="muted small" style={{ marginBottom: 24 }}>
            {isLogin ? 'سجّل الدخول لمتابعة أسانيدك' : 'أنشئ حساباً لتبدأ بتوثيق أسانيدك'}
          </p>

          {err && <div className="alert alert-error" role="alert">{err}</div>}
          {notice && <div className="alert alert-success">{notice}</div>}

          <form onSubmit={submit}>
            <label className="field">
              <span className="field-label">اسم المستخدم</span>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            <label className="field">
              <span className="field-label">كلمة المرور</span>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'} required />
            </label>
            <button className="btn btn-primary btn-block" style={{ height: 44, marginTop: 6 }} disabled={loading}>
              {loading ? <span className="spinner" /> : isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب'}
            </button>
          </form>

          <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
            {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب؟'}{' '}
            <button className="strong" style={{ color: 'var(--primary)' }}
              onClick={() => { setMode(isLogin ? 'register' : 'login'); setErr(''); setNotice(''); }}>
              {isLogin ? 'أنشئ حساباً' : 'سجّل الدخول'}
            </button>
          </p>
        </div>
      </div>

      <div className="auth-art">
        <div className="brand-name" style={{ color: 'inherit' }}>إسناد</div>
        <div>
          <div className="quote">«الإسنادُ من الدِّين، ولولا الإسنادُ لقال مَن شاء ما شاء»</div>
          <div className="attrib">— عبد الله بن المبارك</div>
        </div>
        <ChainArt />
      </div>
    </div>
  );
}
