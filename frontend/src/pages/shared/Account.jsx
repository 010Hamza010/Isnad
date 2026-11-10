import React, { useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Icon from '../../components/ui/Icon';

const when = d => (d ? new Date(d).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** The instance's single account: username, password, sessions. */
export default function Account() {
  const { toast, notifyError, confirm } = useUI();
  const { refresh } = useAuth();
  const { data: me, setData, loading } = useLoad(() => api.get('/auth/me').then(r => r.data), [], null);
  const [name, setName] = useState({ username: '', password: '' });
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [busy, setBusy] = useState('');

  const run = async (what, fn) => {
    setBusy(what);
    try { await fn(); } catch (e) { notifyError(e); } finally { setBusy(''); }
  };

  const rename = e => {
    e.preventDefault();
    run('name', async () => {
      const { data } = await api.put('/auth/username', name);
      refresh(data.token, data.username);
      setData(m => ({ ...m, username: data.username }));
      setName({ username: '', password: '' });
      toast('تغيّر اسم المستخدم');
    });
  };

  const changePw = e => {
    e.preventDefault();
    if (pw.next !== pw.again) { toast('كلمتا المرور الجديدتان غير متطابقتين', 'error'); return; }
    run('pw', async () => {
      const { data } = await api.put('/auth/password', { current: pw.current, next: pw.next });
      refresh(data.token);
      setPw({ current: '', next: '', again: '' });
      toast('تغيّرت كلمة المرور — خرجت الأجهزة الأخرى');
    });
  };

  const logoutOthers = async () => {
    const ok = await confirm({ title: 'تسجيل الخروج من الأجهزة الأخرى', message: 'سيُطلب تسجيل الدخول من جديد على كل جهاز آخر. يبقى هذا الجهاز متصلاً.', confirmLabel: 'تسجيل الخروج' });
    if (ok) run('out', async () => { const { data } = await api.post('/auth/logout-others'); refresh(data.token); toast('خرجت الأجهزة الأخرى'); });
  };

  if (loading || !me) return <div className="skeleton" style={{ height: 320 }} />;

  return (
    <div style={{ maxWidth: 720 }}>
      <section className="card settings-section">
        <div className="card-head"><Icon name="user" /><div className="card-title">اسم المستخدم</div><span className="muted">الحالي: <b>{me.username}</b></span></div>
        <form className="card-pad" onSubmit={rename}>
          <div className="form-grid">
            <Field label="اسم المستخدم الجديد" hint="3 إلى 40 حرفاً، بلا مسافات">
              <input className="input" value={name.username} onChange={e => setName(n => ({ ...n, username: e.target.value }))} autoComplete="username" required />
            </Field>
            <Field label="كلمة المرور الحالية" hint="للتأكيد">
              <input className="input" type="password" value={name.password} onChange={e => setName(n => ({ ...n, password: e.target.value }))} autoComplete="current-password" required />
            </Field>
          </div>
          <button className="btn btn-primary btn-sm" disabled={!!busy}>{busy === 'name' ? <span className="spinner" /> : 'تغيير الاسم'}</button>
        </form>
      </section>

      <section className="card settings-section">
        <div className="card-head"><Icon name="settings" /><div className="card-title">كلمة المرور</div><span className="muted">تغييرها يُخرج الأجهزة الأخرى</span></div>
        <form className="card-pad" onSubmit={changePw}>
          <Field label="كلمة المرور الحالية">
            <input className="input" type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" required />
          </Field>
          <div className="form-grid">
            <Field label="الجديدة" hint="8 أحرف على الأقل">
              <input className="input" type="password" minLength={8} value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} autoComplete="new-password" required />
            </Field>
            <Field label="تأكيد الجديدة">
              <input className="input" type="password" value={pw.again} onChange={e => setPw(p => ({ ...p, again: e.target.value }))} autoComplete="new-password" required />
            </Field>
          </div>
          <button className="btn btn-primary btn-sm" disabled={!!busy}>{busy === 'pw' ? <span className="spinner" /> : 'تغيير كلمة المرور'}</button>
        </form>
      </section>

      <section className="card settings-section">
        <div className="card-head"><Icon name="globe" /><div className="card-title">الجلسات</div></div>
        <div className="card-pad stack">
          <div className="small">الدخول الحالي: <b>{when(me.last_login_at)}</b> · الدخول السابق: <b>{when(me.previous_login_at)}</b></div>
          <div className="small muted">إن لم تعرف الدخول السابق فغيّر كلمة المرور.</div>
          <div><button className="btn btn-secondary btn-sm" onClick={logoutOthers} disabled={!!busy}><Icon name="logout" size={14} /> تسجيل الخروج من الأجهزة الأخرى</button></div>
        </div>
      </section>
    </div>
  );
}
