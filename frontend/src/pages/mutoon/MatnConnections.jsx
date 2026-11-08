import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextArea, Select } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import ReadingModeField, { isReadingKind, READING_LABELS } from '../../components/isnad/ReadingMode';
import { matches, isMe } from '../../utils/text';
import { personOptions, rowOptions, kindOfType } from '../../utils/options';

const EMPTY = { from_person_id: 0, to_person_id: '', matn_id: '', transmission_type_id: '', is_general_ijaza: false, reading_mode: '', description: '' };

// Direction relative to "me" (person 0). Links *to* me are not stored — students live in the ijaza register.
const TABS = [
  { value: 'from_me', label: 'شيوخي',    test: c => isMe(c.from_person_id), anchor: c => c.to_person_id },
  { value: 'others',  label: 'سلاسل الشيوخ', test: c => !isMe(c.from_person_id) && !isMe(c.to_person_id), anchor: c => c.from_person_id },
];

export default function MatnConnections() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [c, p, m, t] = await Promise.all([
      api.get('/matn-connections'), api.get('/persons'),
      api.get('/mutoon'), api.get('/tx-types?applies_to=mutoon'),
    ]);
    return { conns: c.data, persons: p.data, mutoon: m.data, txTypes: t.data };
  }, [], { conns: [], persons: [], mutoon: [], txTypes: [] });
  const { conns, persons, mutoon, txTypes } = data;

  const [tab, setTab]           = useState('from_me');
  const [filterMatn, setFilter] = useState('');
  const [query, setQuery]       = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pOpts   = useMemo(() => personOptions(persons, { includeMe: true }), [persons]);
  const shaykhOpts = useMemo(() => personOptions(persons), [persons]);
  const pName   = id => isMe(id) ? 'أنا' : (persons.find(p => p.id === Number(id))?.name_ar || `#${id}`);
  const current = TABS.find(t => t.value === tab);

  const inMatn = c => !filterMatn || (filterMatn === 'general' ? !c.matn_id : String(c.matn_id) === filterMatn);

  const groups = useMemo(() => {
    const map = new Map();
    conns
      .filter(inMatn)
      .filter(current.test)
      .filter(c => matches(query, c.from_name, c.to_name, c.matn_title, isMe(c.from_person_id) ? 'أنا' : ''))
      .forEach(c => {
        const key = current.anchor(c);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
      });
    return [...map.entries()]
      .map(([pid, items]) => ({ pid, name: pName(pid), items }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'ar'));
  }, [conns, tab, filterMatn, query, persons]);

  const counts = Object.fromEntries(TABS.map(t => [t.value, conns.filter(inMatn).filter(t.test).length]));
  const shown  = groups.reduce((n, g) => n + g.items.length, 0);

  const openAdd = () => setForm({ ...EMPTY, ...(tab === 'others' ? { from_person_id: '' } : {}), matn_id: filterMatn !== 'general' ? filterMatn : '' });
  const openEdit = c => setForm({
    id: c.id, from_person_id: c.from_person_id, to_person_id: c.to_person_id,
    matn_id: c.matn_id ?? '', transmission_type_id: c.transmission_type_id ?? '',
    is_general_ijaza: !!c.is_general_ijaza, reading_mode: c.reading_mode ?? '', description: c.description ?? '',
  });

  const save = async () => {
    if (form.from_person_id === '' || form.to_person_id === '') return toast('اختر الطرفين', 'error');
    if (String(form.from_person_id) === String(form.to_person_id)) return toast('لا يمكن أن يتصل الشخص بنفسه', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        from_person_id: Number(form.from_person_id),
        to_person_id: Number(form.to_person_id),
        matn_id: form.matn_id || null,
        transmission_type_id: form.transmission_type_id || null,
        reading_mode: isReadingKind(kindOfType(txTypes, form.transmission_type_id)) ? form.reading_mode || null : null,
      };
      if (form.id) await api.put(`/matn-connections/${form.id}`, payload);
      else await api.post('/matn-connections', payload);
      toast(form.id ? 'تم حفظ التعديلات' : 'تمت إضافة الاتصال');
      setForm(null); reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async c => {
    const ok = await confirm({ title: 'حذف اتصال', message: `${pName(c.from_person_id)} ← ${pName(c.to_person_id)}`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/matn-connections/${c.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  return (
    <>
      <div className="toolbar">
        <Segmented value={tab} onChange={v => { setTab(v); setCollapsed({}); }}
          options={TABS.map(t => ({ value: t.value, label: t.label, count: counts[t.value] }))} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={16} /> اتصال جديد</button>
      </div>
      <div className="toolbar">
        <SearchInput className="search" value={query} onChange={setQuery} placeholder="ابحث باسم الشيخ أو المتن…" />
        <select className="select" style={{ width: 'auto', minWidth: 200 }} value={filterMatn} onChange={e => setFilter(e.target.value)}>
          <option value="">كل المتون</option>
          <option value="general">إجازة عامة (بلا متن)</option>
          {mutoon.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        {(query || filterMatn) && <span className="small muted">{shown} من {counts[tab]}</span>}
      </div>

      {loading && !conns.length ? <SkeletonList /> : groups.length === 0 ? (
        <EmptyState icon="link" title="لا توجد اتصالات مطابقة"
          subtitle={tab === 'from_me' ? 'أضف شيخاً أخذتَ عنه متناً أو إجازة' : undefined}
          action={<button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={16} /> اتصال جديد</button>} />
      ) : (
        <div className="stack">
          {groups.map(g => {
            const open = !collapsed[g.pid];
            return (
              <div key={g.pid} className="card">
                <button className="accordion-head card-head" aria-expanded={open}
                  style={{ borderBottom: open ? undefined : 'none' }}
                  onClick={() => setCollapsed(s => ({ ...s, [g.pid]: open }))}>
                  <Icon name="chevron" size={16} className="chev" />
                  <span className="display strong" style={{ fontSize: 18 }}>{g.name}</span>
                  <span className="badge">{g.items.length}</span>
                </button>
                {open && g.items.map(c => (
                  <div key={c.id} className="list-item">
                    <div className="list-main">
                      <div className="conn">
                        <span className={`from${isMe(c.from_person_id) ? ' me' : ''}`}>{pName(c.from_person_id)}</span>
                        <span className="arrow"><Icon name="arrow" size={14} /></span>
                        <span className="to">{pName(c.to_person_id)}</span>
                        {c.tx_name && <span className="badge badge-primary">{c.tx_name}</span>}
                        {c.is_general_ijaza ? <span className="badge badge-accent">إجازة عامة</span> : null}
                        {c.reading_mode && <span className="badge badge-success">{READING_LABELS[c.reading_mode]}</span>}
                        <span className={`badge ${c.matn_title ? 'badge-info' : 'badge-outline'}`}>{c.matn_title || 'كل المتون'}</span>
                      </div>
                      {c.description && <div className="small muted" style={{ marginTop: 2 }}>{c.description}</div>}
                    </div>
                    <div className="actions">
                      <button className="icon-btn" onClick={() => openEdit(c)} aria-label="تعديل"><Icon name="edit" size={16} /></button>
                      <button className="icon-btn danger" onClick={() => del(c)} aria-label="حذف"><Icon name="trash" size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <FormModal title={form.id ? 'تعديل الاتصال' : 'اتصال جديد'} onClose={() => setForm(null)} onSubmit={save} saving={saving}>
          <div className="callout" style={{ marginBottom: 14 }}>
            سجّل حلقة واحدة فقط: <strong>التلميذ</strong> أخذ عن <strong>الشيخ</strong>. السلاسل الكاملة تُبنى تلقائياً.
          </div>
          <div className="form-grid">
            <Field label="التلميذ (من)" required>
              <Combobox value={form.from_person_id} opts={pOpts} onChange={v => set('from_person_id', v)} />
            </Field>
            <Field label="الشيخ (أخذ عن)" required>
              <Combobox value={form.to_person_id} opts={shaykhOpts} onChange={v => set('to_person_id', v)} />
            </Field>
          </div>
          <Field label="المتن" hint="اتركه فارغاً إن كانت إجازة عامة بكل مروياته">
            <Combobox value={form.matn_id} opts={rowOptions(mutoon, 'title')} onChange={v => set('matn_id', v)} placeholder="كل المتون" />
          </Field>
          <Field label="طريقة التحمل" hint="عند تعدد الاتصالات بين شخصين يُقدَّم الأعلى: السماع ثم القراءة ثم الإجازة…">
            <Select form={form} set={set} name="transmission_type_id" options={rowOptions(txTypes)} />
          </Field>
          <ReadingModeField kind={kindOfType(txTypes, form.transmission_type_id)} value={form.reading_mode} onChange={v => set('reading_mode', v)} />
          <label className="check" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={form.is_general_ijaza} onChange={e => set('is_general_ijaza', e.target.checked)} />
            إجازة عامة
          </label>
          <Field label="ملاحظات"><TextArea form={form} set={set} name="description" placeholder="المكان، التاريخ، ما قُرئ…" /></Field>
        </FormModal>
      )}
    </>
  );
}
