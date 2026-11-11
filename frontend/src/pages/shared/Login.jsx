import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../components/ui/UIProvider';
import Icon from '../../components/ui/Icon';
import api from '../../utils/api';

// three.js: its own chunk, shared with the home page's sky
const LoginSky = lazy(() => import('../../components/auth/LoginSky'));

const QUOTE = '«الإسنادُ من الدِّين، ولولا الإسنادُ لقال مَن شاء ما شاء»';
const WIDE = '(min-width: 861px)';   // the art panel shows from here (see .auth in globals.css)

const useMedia = query => {
  const get = () => window.matchMedia?.(query).matches ?? true;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
};

/** The quote, word by word (the whole sentence for screen readers). */
const Quote = () => (
  <div className="quote" aria-label={QUOTE}>
    {QUOTE.split(' ').map((w, i) => (
      <span key={i} aria-hidden="true" className="quote-word" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>{w} </span>
    ))}
  </div>
);

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [remember, setRemember] = useState(true);
  const [setup, setSetup] = useState(false);   // first run: no account yet on this instance
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [done, setDone] = useState(false);
  const skyRef = useRef(null);
  const wide = useMedia(WIDE);
  const { login } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api.get('/auth/status').then(r => setSetup(!!r.data.setup)).catch(() => {});
  }, []);

  // replay the shake on every failure (off, then on in the next frame); the card keeps its focus
  const shake = () => { setShaking(false); requestAnimationFrame(() => setShaking(true)); };

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (setup && password !== confirmPw) { setErr('كلمتا المرور غير متطابقتين'); shake(); return; }
    setLoading(true);
    try {
      const { data } = await api.post(setup ? '/auth/setup' : '/auth/login', { username, password, remember });
      setDone(true);
      // light runs up the chain, then in (never more than 1.2 s, even if the sky did not load)
      await Promise.race([skyRef.current?.flash() ?? Promise.resolve(), new Promise(r => setTimeout(r, 1200))]);
      login(data.token, data.username, setup || remember);
      nav('/');
    } catch (e) {
      setErr(errorMessage(e));
      shake();
      if (e.response?.status === 403 && setup) setSetup(false); // created meanwhile: log in instead
    } finally { setLoading(false); }
  };

  return (
    <div className={`auth${done ? ' auth-done' : ''}`}>
      <div className="auth-panel">
        {!wide && (
          <div className="auth-strip">
            <Suspense fallback={null}><LoginSky ref={skyRef} variant="strip" /></Suspense>
          </div>
        )}
        <div className={`auth-card${shaking ? ' shake' : ''}`} onAnimationEnd={e => { if (e.target === e.currentTarget) setShaking(false); }}>
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
              <span className="input-wrap">
                <input className="input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 8 : undefined} required />
                <button type="button" className="input-eye" onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} aria-pressed={showPw} title={showPw ? 'إخفاء' : 'إظهار'}>
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={17} />
                </button>
              </span>
              {setup && <span className="field-hint">8 أحرف على الأقل</span>}
            </label>
            {setup ? (
              <label className="field">
                <span className="field-label">تأكيد كلمة المرور</span>
                <input className="input" type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" required />
              </label>
            ) : (
              <label className="row small" style={{ gap: 8, marginBottom: 12 }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> تذكرني على هذا الجهاز
              </label>
            )}
            <button className={`btn btn-primary btn-block${done ? ' btn-done' : ''}`} style={{ height: 44, marginTop: 6 }} disabled={loading}>
              {done ? <Icon name="check" size={20} strokeWidth={2.4} /> : loading ? <span className="spinner" /> : setup ? 'إنشاء الحساب والدخول' : 'تسجيل الدخول'}
            </button>
          </form>

        </div>
      </div>

      <div className="auth-art">
        <div className="brand-name" style={{ color: 'inherit' }}>إسناد</div>
        {wide && <Suspense fallback={null}><LoginSky ref={skyRef} variant="panel" /></Suspense>}
        <div className="auth-art-quote">
          <Quote />
          <div className="attrib">— عبد الله بن المبارك</div>
        </div>
      </div>
    </div>
  );
}
