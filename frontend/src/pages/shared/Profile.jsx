import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';

/** Personal settings used everywhere: names, gender, default place. */
export default function Profile() {
  const { toast, notifyError } = useUI();
  const { data: saved, setData, loading } = useLoad(() => api.get('/profile').then(r => r.data), [], null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (saved && !draft) setDraft(saved); }, [saved]);
  if (loading || !draft) return <div className="skeleton" style={{ height: 320 }} />;

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put('/profile', draft); setData(data); setDraft(data); toast('حُفظ الملف الشخصي'); }
    catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <section className="card card-pad settings-section">
        <Field label="الاسم الكامل" hint="يُكتب في الإجازات موضع {المجيز}، مثل «وكتبه: …»">
          <input className="input" value={draft.full_name} onChange={e => set('full_name', e.target.value)}
            placeholder="الفقير إلى ربه فلان بن فلان بن فلان الفلاني" />
        </Field>
        <Field label="الاسم المختصر" hint="يظهر في شجرة الإسناد وكل موضع يحتاج اسماً قصيراً؛ إن تُرك فارغاً استُعمل الاسم الكامل">
          <input className="input" value={draft.short_name} maxLength={60} onChange={e => set('short_name', e.target.value)} placeholder="فلان الفلاني" />
        </Field>
        <div className="form-grid">
          <div className="field">
            <span className="field-label">الجنس</span>
            <Segmented value={draft.gender} onChange={v => set('gender', v)} options={[{ value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' }]} />
            <span className="field-hint">لصياغة {'{المجيز:وكتبه|وكتبته}'} وعباراتك في الأسانيد</span>
          </div>
          <Field label="المكان الافتراضي" hint="مكان الإصدار في الإجازات (يُعدَّل في كل إجازة)">
            <input className="input" value={draft.place} onChange={e => set('place', e.target.value)} placeholder="فاس" />
          </Field>
        </div>
      </section>

      {dirty && (
        <div className="savebar">
          <Icon name="alert" size={16} /><span className="spacer small">لديك تغييرات غير محفوظة</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft(saved)}>تراجع</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'حفظ'}</button>
        </div>
      )}
    </div>
  );
}
