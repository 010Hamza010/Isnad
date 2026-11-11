import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, Select } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { personOptions, rowOptions } from '../../utils/options';
import QuranGroups from './QuranGroups';

const TYPES = {
  qiraat:  { label: 'القراءات', one: 'قراءة', icon: 'quran' },
  riwayat: { label: 'الروايات', one: 'رواية', icon: 'book' },
  turuq:   { label: 'الطرق',    one: 'طريق',  icon: 'chain' },
};

export default function QuranMasterData() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [q, r, t, p] = await Promise.all([
      api.get('/quran/qiraat'), api.get('/quran/riwayat'), api.get('/quran/turuq'), api.get('/persons'),
    ]);
    return { qiraat: q.data, riwayat: r.data, turuq: t.data, persons: p.data };
  }, [], { qiraat: [], riwayat: [], turuq: [], persons: [] });
  const { qiraat, riwayat, turuq, persons } = data;

  const [tab, setTab]       = useState('qiraat');
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pOpts = useMemo(() => personOptions(persons), [persons]);

  // riwayat grouped under their qiraa; turuq grouped under their riwaya
  const groups = useMemo(() => {
    if (tab === 'qiraat') return [[null, qiraat]];
    const rows = tab === 'riwayat' ? riwayat : turuq;
    const key  = tab === 'riwayat' ? 'qiraa_name' : 'riwaya_name';
    const g = new Map();
    rows.forEach(r => { const k = r[key] || 'غير مصنّف'; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    return [...g.entries()];
  }, [tab, qiraat, riwayat, turuq]);

  const subtitle = row => {
    if (tab === 'qiraat')  return row.imam_name && `الإمام ${row.imam_name}`;
    if (tab === 'riwayat') return row.rawi_name && `الراوي ${row.rawi_name}`;
    return row.parent_name && `متفرّع من طريق ${row.parent_name}`;
  };

  const save = async () => {
    const { type, id, ...payload } = form;
    if (!payload.name_ar?.trim()) return toast('الاسم مطلوب', 'error');
    if (type === 'riwayat' && !payload.qiraa_id) return toast('اختر القراءة', 'error');
    setSaving(true);
    try {
      if (id) await api.put(`/quran/${type}/${id}`, payload);
      else await api.post(`/quran/${type}`, payload);
      toast(id ? 'تم حفظ التعديلات' : 'تمت الإضافة');
      setForm(null); reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async row => {
    const ok = await confirm({ title: `حذف ${TYPES[tab].one}`, message: `سيُحذف «${row.name_ar}».`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/quran/${tab}/${row.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  const clean = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? '']));
  const openAdd  = () => setForm({ type: tab, name_ar: '', description: '' });
  const openEdit = row => setForm({ type: tab, ...clean(row) });
  const rows = tab === 'qiraat' ? qiraat : tab === 'riwayat' ? riwayat : turuq;
  const tabs = (
    <Segmented value={tab} onChange={setTab} options={[
      { value: 'qiraat', label: 'القراءات', count: qiraat.length },
      { value: 'riwayat', label: 'الروايات', count: riwayat.length },
      { value: 'turuq', label: 'الطرق', count: turuq.length },
      { value: 'groups', label: 'المجموعات' },
    ]} />
  );

  if (tab === 'groups') return <><div className="toolbar">{tabs}</div><QuranGroups qiraat={qiraat} riwayat={riwayat} /></>;

  return (
    <>
      <div className="toolbar">
        {tabs}
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={16} /> {TYPES[tab].one} جديدة</button>
      </div>

      {loading && !rows.length ? <SkeletonList /> : rows.length === 0 ? (
        <EmptyState icon={TYPES[tab].icon} title={`لا توجد ${TYPES[tab].label}`}
          action={<button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={16} /> إضافة</button>} />
      ) : groups.map(([label, items]) => (
        <section key={label || 'all'}>
          {label && <div className="group-head">{label}<span className="badge">{items.length}</span><span className="line" /></div>}
          <div className="list">
            {items.map(row => (
              <div key={row.id} className="list-item">
                <div className="list-main">
                  <div className="list-title display" style={{ fontSize: 17 }}>{row.name_ar}</div>
                  {(subtitle(row) || row.description) && (
                    <div className="list-sub">{[subtitle(row), row.description].filter(Boolean).join(' — ')}</div>
                  )}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => openEdit(row)} aria-label="تعديل" title="تعديل"><Icon name="edit" size={16} /></button>
                  <button className="icon-btn danger" onClick={() => del(row)} aria-label="حذف" title="حذف"><Icon name="trash" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {form && (
        <FormModal title={`${form.id ? 'تعديل' : 'إضافة'} ${TYPES[form.type].one}`} onClose={() => setForm(null)} onSubmit={save} saving={saving}>
          <Field label="الاسم" required><TextInput form={form} set={set} name="name_ar" /></Field>
          {form.type === 'qiraat' && (
            <Field label="الإمام"><Combobox value={form.imam_id ?? ''} opts={pOpts} onChange={v => set('imam_id', v)} /></Field>
          )}
          {form.type === 'riwayat' && <>
            <Field label="القراءة" required><Select form={form} set={set} name="qiraa_id" options={rowOptions(qiraat)} placeholder="— اختر —" /></Field>
            <Field label="الراوي"><Combobox value={form.rawi_id ?? ''} opts={pOpts} onChange={v => set('rawi_id', v)} /></Field>
          </>}
          {form.type === 'turuq' && <>
            <Field label="الرواية"><Select form={form} set={set} name="riwaya_id" options={rowOptions(riwayat)} /></Field>
            <Field label="الطريق الأصل" hint="للطرق المتفرّعة من طريق آخر">
              <Select form={form} set={set} name="parent_id"
                options={rowOptions(turuq.filter(t => t.id !== form.id && (!form.riwaya_id || String(t.riwaya_id) === String(form.riwaya_id))))} />
            </Field>
          </>}
          <Field label="وصف"><TextArea form={form} set={set} name="description" /></Field>
        </FormModal>
      )}
    </>
  );
}
