import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, Select } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Icon from '../../components/ui/Icon';
import { matches } from '../../utils/text';
import { personOptions, SUBJECTS } from '../../utils/options';

const EMPTY = { title: '', author_id: '', subject: '', description: '' };
const OTHER = 'بدون تصنيف';

export default function MatnList() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [m, p] = await Promise.all([api.get('/mutoon'), api.get('/persons')]);
    return { mutoon: m.data, persons: p.data };
  }, [], { mutoon: [], persons: [] });
  const { mutoon, persons } = data;

  const [subject, setSubject] = useState('');
  const [search, setSearch]   = useState('');
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const authorOpts = useMemo(() => personOptions(persons), [persons]);

  const subjectsInUse = useMemo(() => {
    const counts = new Map();
    mutoon.forEach(m => { const s = m.subject || OTHER; counts.set(s, (counts.get(s) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [mutoon]);

  const groups = useMemo(() => {
    const g = new Map();
    mutoon
      .filter(m => !subject || (m.subject || OTHER) === subject)
      .filter(m => matches(search, m.title, m.author_name, m.description))
      .forEach(m => { const s = m.subject || OTHER; if (!g.has(s)) g.set(s, []); g.get(s).push(m); });
    return [...g.entries()];
  }, [mutoon, subject, search]);

  const save = async () => {
    if (!form.title.trim()) return toast('عنوان المتن مطلوب', 'error');
    setSaving(true);
    try {
      if (form.id) await api.put(`/mutoon/${form.id}`, form);
      else await api.post('/mutoon', form);
      toast(form.id ? 'تم حفظ التعديلات' : 'تمت إضافة المتن');
      setForm(null); reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async m => {
    const ok = await confirm({ title: 'حذف متن', message: `سيُحذف «${m.title}» نهائياً.`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/mutoon/${m.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  return (
    <>
      <div className="toolbar">
        <SearchInput className="search" value={search} onChange={setSearch} placeholder="ابحث بالعنوان أو المؤلف…" />
        <button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Icon name="plus" size={16} /> متن جديد</button>
      </div>
      <div className="chips" style={{ marginBottom: 18 }}>
        <button className={`chip${!subject ? ' active' : ''}`} onClick={() => setSubject('')}>الكل · {mutoon.length}</button>
        {subjectsInUse.map(([s, n]) => (
          <button key={s} className={`chip${subject === s ? ' active' : ''}`} onClick={() => setSubject(s)}>{s} · {n}</button>
        ))}
      </div>

      {loading && !mutoon.length ? <SkeletonList /> : groups.length === 0 ? (
        <EmptyState icon="books" title={search || subject ? 'لا نتائج مطابقة' : 'لا توجد متون بعد'}
          action={!search && !subject && <button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Icon name="plus" size={16} /> إضافة متن</button>} />
      ) : groups.map(([s, items]) => (
        <section key={s}>
          <div className="group-head">{s} <span className="badge">{items.length}</span><span className="line" /></div>
          <div className="grid grid-auto">
            {items.map(m => (
              <div key={m.id} className="card card-pad tile">
                <div className="list-main">
                  <div className="list-title display" style={{ fontSize: 18, lineHeight: 1.4 }}>{m.title}</div>
                  <div className="list-sub">{m.author_name ? `للإمام ${m.author_name}` : 'المؤلف غير محدد'}</div>
                  {m.description && <div className="small muted clamp-2" style={{ marginTop: 4 }}>{m.description}</div>}
                </div>
                <div className="actions">
                  <button className="icon-btn sm" onClick={() => setForm({ ...EMPTY, ...m, author_id: m.author_id ?? '', subject: m.subject ?? '', description: m.description ?? '' })} aria-label="تعديل"><Icon name="edit" size={15} /></button>
                  <button className="icon-btn sm danger" onClick={() => del(m)} aria-label="حذف"><Icon name="trash" size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {form && (
        <FormModal title={form.id ? 'تعديل المتن' : 'متن جديد'} onClose={() => setForm(null)} onSubmit={save} saving={saving}>
          <Field label="عنوان المتن" required><TextInput form={form} set={set} name="title" placeholder="مثال: الآجرومية" /></Field>
          <Field label="المؤلف" hint="سلاسل الإسناد تنتهي عند المؤلف — بدونه لا يمكن بناء السند">
            <Combobox value={form.author_id} opts={authorOpts} onChange={v => set('author_id', v)} placeholder="ابحث عن المؤلف…" />
          </Field>
          <Field label="الموضوع">
            <Select form={form} set={set} name="subject" options={SUBJECTS.map(s => ({ value: s, label: s }))} placeholder="— اختر —" />
          </Field>
          <Field label="وصف"><TextArea form={form} set={set} name="description" /></Field>
        </FormModal>
      )}
    </>
  );
}
