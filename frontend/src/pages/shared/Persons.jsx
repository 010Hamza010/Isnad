import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, Select } from '../../components/ui/Field';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { matches } from '../../utils/text';
import { rowOptions } from '../../utils/options';

const EMPTY = { name_ar: '', name_latin: '', gender: 'M', kunya: '', nisba: '', century: '', death_year: '', region: '', description: '', primary_qiraa_id: '' };

export default function Persons() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [p, q] = await Promise.all([api.get('/persons'), api.get('/quran/qiraat')]);
    return { persons: p.data, qiraat: q.data };
  }, [], { persons: [], qiraat: [] });
  const { persons, qiraat } = data;

  const [search, setSearch] = useState('');
  const [kind, setKind]     = useState('all');
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const qiraaName = id => qiraat.find(q => Number(q.id) === Number(id))?.name_ar;

  const filtered = useMemo(() => persons
    .filter(p => kind === 'all' || (kind === 'imams' ? p.primary_qiraa_id : !p.primary_qiraa_id))
    .filter(p => matches(search, p.name_ar, p.name_latin, p.kunya, p.nisba, p.region)),
  [persons, search, kind]);

  const imams = persons.filter(p => p.primary_qiraa_id).length;

  const save = async () => {
    if (!form.name_ar.trim()) return toast('الاسم بالعربية مطلوب', 'error');
    setSaving(true);
    try {
      if (form.id) await api.put(`/persons/${form.id}`, form);
      else await api.post('/persons', form);
      toast(form.id ? 'تم حفظ التعديلات' : 'تمت إضافة العلَم');
      setForm(null); reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async p => {
    const ok = await confirm({ title: 'حذف علَم', message: `سيُحذف «${p.name_ar}». الاتصالات المرتبطة به ستصبح منقطعة.`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/persons/${p.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  const openEdit = p => setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])) });

  return (
    <>
      <div className="toolbar">
        <SearchInput className="search" value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الكنية أو البلد…" />
        <Segmented value={kind} onChange={setKind} options={[
          { value: 'all', label: 'الكل', count: persons.length },
          { value: 'imams', label: 'أئمة القراءات', count: imams },
          { value: 'others', label: 'غيرهم', count: persons.length - imams },
        ]} />
        <button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Icon name="plus" size={16} /> علَم جديد</button>
      </div>

      {loading && !persons.length ? <SkeletonList /> : filtered.length === 0 ? (
        <EmptyState icon="users" title={search ? 'لا نتائج مطابقة' : 'لا يوجد أعلام بعد'}
          subtitle={search ? 'جرّب كلمة أخرى' : 'أضف شيخك الأول لتبدأ'}
          action={!search && <button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Icon name="plus" size={16} /> إضافة</button>} />
      ) : (
        <div className="list">
          {filtered.map(p => (
            <div key={p.id} className="list-item">
              <div className="avatar" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>{p.name_ar.replace(/^(ال|أبو |ابن )/, '').slice(0, 1)}</div>
              <div className="list-main">
                <div className="row row-wrap" style={{ gap: 6 }}>
                  <span className="list-title display" style={{ fontSize: 17 }}>{p.name_ar}</span>
                  {p.kunya && <span className="muted small">({p.kunya})</span>}
                  {p.gender === 'F' && <span className="badge badge-purple">أنثى</span>}
                  {p.primary_qiraa_id && <span className="badge badge-accent">{qiraaName(p.primary_qiraa_id)}</span>}
                </div>
                <div className="list-sub">
                  {[p.death_year && `ت ${p.death_year}`, p.century && `القرن ${p.century}`, p.region, p.name_latin].filter(Boolean).join(' · ')}
                </div>
                {p.description && <div className="small muted clamp-2" style={{ marginTop: 2 }}>{p.description}</div>}
              </div>
              <div className="actions">
                <button className="icon-btn" onClick={() => openEdit(p)} aria-label="تعديل"><Icon name="edit" size={16} /></button>
                <button className="icon-btn danger" onClick={() => del(p)} aria-label="حذف"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <FormModal title={form.id ? 'تعديل العلَم' : 'علَم جديد'} onClose={() => setForm(null)} onSubmit={save} saving={saving}>
          <Field label="الاسم بالعربية" required>
            <TextInput form={form} set={set} name="name_ar" placeholder="مثال: محمد بن أحمد الحسني" />
          </Field>
          <div className="field">
            <span className="field-label">الجنس</span>
            <Segmented value={form.gender || 'M'} onChange={v => set('gender', v)} options={[{ value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' }]} />
            <span className="field-hint">تُصاغ به الضمائر والأفعال في الأسانيد والإجازات: «وهي قرأت على…»</span>
          </div>
          <div className="form-grid">
            <Field label="الكنية"><TextInput form={form} set={set} name="kunya" placeholder="أبو عبد الله" /></Field>
            <Field label="النسبة"><TextInput form={form} set={set} name="nisba" placeholder="المالكي، الفاسي" /></Field>
            <Field label="سنة الوفاة"><TextInput form={form} set={set} name="death_year" placeholder="852هـ" /></Field>
            <Field label="القرن"><TextInput form={form} set={set} name="century" type="number" min="1" max="15" placeholder="9" /></Field>
            <Field label="البلد / المنطقة"><TextInput form={form} set={set} name="region" placeholder="المغرب" /></Field>
            <Field label="الاسم بالحروف اللاتينية"><TextInput form={form} set={set} name="name_latin" placeholder="Ibn Hajar" dir="ltr" /></Field>
          </div>
          <Field label="إمام قراءة" hint="يُحدَّد لأئمة القراءات فقط، ويُستخدم لتصفية الأسانيد القرآنية">
            <Select form={form} set={set} name="primary_qiraa_id" options={rowOptions(qiraat)} placeholder="— ليس إماماً —" />
          </Field>
          <Field label="ترجمة وملاحظات"><TextArea form={form} set={set} name="description" placeholder="ترجمة مختصرة، شيوخه، إجازاته…" /></Field>
        </FormModal>
      )}
    </>
  );
}
