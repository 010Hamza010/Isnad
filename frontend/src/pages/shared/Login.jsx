import React, { useEffect, useState } from 'react';
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
  const [confirmPw, setConfirmPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [setup, setSetup] = useState(false);   // first run: no account yet on this instance
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api.get('/auth/status').then(r => setSetup(!!r.data.setup)).catch(() => {});
  }, []);

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (setup && password !== confirmPw) { setErr('كلمتا المرور غير متطابقتين'); return; }
    setLoading(true);
    try {
      const { data } = await api.post(setup ? '/auth/setup' : '/auth/login', { username, password, remember });
      login(data.token, data.username, setup || remember);
      nav('/');
    } catch (e) {
      setErr(errorMessage(e));
      if (e.response?.status === 403 && setup) setSetup(false); // created meanwhile: log in instead
    } finally { setLoading(false); }
  };

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-card">
          <div className="brand" style={{ padding: 0, marginBottom: 28 }}>
            <div className="brand-mark">س</div>
            <div><div className="brand-name">إسناد</div><div className="brand-tag">إدارة الأسانيد والمتون</div></div>
          </div>
          <h1>{setup ? 'إعداد الحساب' : 'مرحباً بعودتك'}</h1>
          <p className="muted small" style={{ marginBottom: 24 }}>
            {setup ? 'أول تشغيل: أنشئ حسابك — حساب واحد لهذه النسخة' : 'سجّل الدخول لمتابعة أسانيدك'}
          </p>

          {err && <div className="alert alert-error" role="alert">{err}</div>}

          <form onSubmit={submit}>
            <label className="field">
              <span className="field-label">اسم المستخدم</span>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            <label className="field">
              <span className="field-label">كلمة المرور</span>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 8 : undefined} required />
              {setup && <span className="field-hint">8 أحرف على الأقل</span>}
            </label>
            {setup ? (
              <label className="field">
                <span className="field-label">تأكيد كلمة المرور</span>
                <input className="input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" required />
              </label>
            ) : (
              <label className="row small" style={{ gap: 8, marginBottom: 12 }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> تذكرني على هذا الجهاز
              </label>
            )}
            <button className="btn btn-primary btn-block" style={{ height: 44, marginTop: 6 }} disabled={loading}>
              {loading ? <span className="spinner" /> : setup ? 'إنشاء الحساب والدخول' : 'تسجيل الدخول'}
            </button>
          </form>

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
