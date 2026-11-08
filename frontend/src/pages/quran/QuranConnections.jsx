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
import ReadingModeField, { isReadingTx, READING_LABELS } from '../../components/isnad/ReadingMode';
import { matches, isMe } from '../../utils/text';
import { personOptions, rowOptions } from '../../utils/options';

const MODES = ['حضوراً', 'عن بُعد', 'مختلط'];
const EMPTY = {
  from_person_id: 0, to_person_id: '', transmission_type_id: '', khatmat_count: 1,
  ijaza_date: '', meeting_mode: 'حضوراً', reading_mode: '', notes: '', description: '', items: [],
};
const EMPTY_ITEM = { qiraa_id: '', riwaya_id: '', tariq_id: '' };

export default function QuranConnections() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [c, p, q, r, t, tx] = await Promise.all([
      api.get('/quran-connections'), api.get('/persons'),
      api.get('/quran/qiraat'), api.get('/quran/riwayat'),
      api.get('/quran/turuq'), api.get('/tx-types?applies_to=quran'),
    ]);
    return { conns: c.data, persons: p.data, qiraat: q.data, riwayat: r.data, turuq: t.data, txTypes: tx.data };
  }, [], { conns: [], persons: [], qiraat: [], riwayat: [], turuq: [], txTypes: [] });
  const { conns, persons, qiraat, riwayat, turuq, txTypes } = data;

  const [filterQ, setFilterQ] = useState('');
  const [query, setQuery]     = useState('');
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pOpts = useMemo(() => personOptions(persons, { includeMe: true }), [persons]);
  const shaykhOpts = useMemo(() => personOptions(persons), [persons]);

  const byId = (rows, id) => rows.find(x => String(x.id) === String(id));
  const itemQiraa = it => it.qiraa_id || byId(riwayat, it.riwaya_id)?.qiraa_id;
  const scopeLabel = it => [byId(qiraat, itemQiraa(it))?.name_ar, byId(riwayat, it.riwaya_id)?.name_ar, byId(turuq, it.tariq_id)?.name_ar].filter(Boolean).join(' · ');

  // ── scope item editing (cascading qiraa → riwaya → tariq) ──
  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'qiraa_id')  { items[i].riwaya_id = ''; items[i].tariq_id = ''; }
    if (field === 'riwaya_id') { items[i].tariq_id = ''; }
    return { ...f, items };
  });

  const visible = conns
    .filter(c => !filterQ || !c.items?.length || c.items.some(it => String(itemQiraa(it)) === filterQ))
    .filter(c => matches(query, c.from_name, c.to_name, isMe(c.from_person_id) ? 'أنا' : ''));

  const openEdit = c => setForm({
    ...EMPTY, id: c.id,
    from_person_id: c.from_person_id, to_person_id: c.to_person_id,
    transmission_type_id: c.transmission_type_id ?? '', khatmat_count: c.khatmat_count ?? 1,
    ijaza_date: c.ijaza_date ?? '', meeting_mode: c.meeting_mode || 'حضوراً', reading_mode: c.reading_mode ?? '',
    notes: c.notes ?? '', description: c.description ?? '',
    items: (c.items || []).map(it => ({
      qiraa_id: String(it.qiraa_id || ''), riwaya_id: String(it.riwaya_id || ''), tariq_id: String(it.tariq_id || ''),
    })),
  });

  const save = async () => {
    if (form.from_person_id === '' || form.to_person_id === '') return toast('اختر الطرفين', 'error');
    if (String(form.from_person_id) === String(form.to_person_id)) return toast('لا يمكن أن يتصل الشخص بنفسه', 'error');
    setSaving(true);
    try {
      const payload = {
        from_person_id:       Number(form.from_person_id) || 0,
        to_person_id:         Number(form.to_person_id),
        transmission_type_id: form.transmission_type_id || null,
        khatmat_count:        parseInt(form.khatmat_count) || 1,
        ijaza_date:           form.ijaza_date || null,
        meeting_mode:         form.meeting_mode || 'حضوراً',
        reading_mode:         isReadingTx(form.transmission_type_id) ? form.reading_mode || null : null,
        notes:                form.notes || null,
        description:          form.description || null,
        items: form.items
          .filter(it => it.qiraa_id || it.riwaya_id || it.tariq_id)
          .map(it => ({ qiraa_id: it.qiraa_id || null, riwaya_id: it.riwaya_id || null, tariq_id: it.tariq_id || null })),
      };
      if (form.id) await api.put(`/quran-connections/${form.id}`, payload);
      else await api.post('/quran-connections', payload);
      toast(form.id ? 'تم حفظ التعديلات' : 'تمت إضافة الاتصال');
      setForm(null); reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async c => {
    const ok = await confirm({ title: 'حذف اتصال', message: `${c.from_name || 'أنا'} ← ${c.to_name}`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/quran-connections/${c.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  return (
    <>
      <div className="toolbar">
        <SearchInput className="search" value={query} onChange={setQuery} placeholder="ابحث باسم الشيخ…" />
        <select className="select" style={{ width: 'auto', minWidth: 180 }} value={filterQ} onChange={e => setFilterQ(e.target.value)}>
          <option value="">كل القراءات</option>
          {qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY, items: [] })}><Icon name="plus" size={16} /> اتصال قرآني</button>
      </div>

      {loading && !conns.length ? <SkeletonList /> : visible.length === 0 ? (
        <EmptyState icon="quran" title="لا توجد اتصالات قرآنية" subtitle="سجّل من قرأتَ عليه القرآن، وبأي رواية"
          action={<button className="btn btn-primary" onClick={() => setForm({ ...EMPTY, items: [] })}><Icon name="plus" size={16} /> إضافة</button>} />
      ) : (
        <div className="list">
          {visible.map(c => (
            <div key={c.id} className="list-item">
              <div className="list-main">
                <div className="conn">
                  <span className={`from${isMe(c.from_person_id) ? ' me' : ''}`}>{isMe(c.from_person_id) ? 'أنا' : c.from_name || `#${c.from_person_id}`}</span>
                  <span className="arrow"><Icon name="arrow" size={14} /></span>
                  <span className="to">{c.to_name || `#${c.to_person_id}`}</span>
                  {c.tx_name && <span className="badge badge-primary">{c.tx_name}</span>}
                </div>
                <div className="chips" style={{ marginTop: 6, gap: 5 }}>
                  {c.items?.length
                    ? c.items.map((it, i) => <span key={i} className="badge badge-accent">{scopeLabel(it) || 'مطلق'}</span>)
                    : <span className="badge badge-outline">مطلق — كل ما قُرئ</span>}
                  {c.reading_mode && <span className="badge badge-success">{READING_LABELS[c.reading_mode]}</span>}
                  {c.meeting_mode && c.meeting_mode !== 'حضوراً' && <span className="badge badge-info"><Icon name="globe" size={12} /> {c.meeting_mode}</span>}
                  {c.khatmat_count > 1 && <span className="badge"><Icon name="repeat" size={12} /> {c.khatmat_count} ختمات</span>}
                  {c.ijaza_date && <span className="badge badge-purple"><Icon name="calendar" size={12} /> {c.ijaza_date}</span>}
                </div>
              </div>
              <div className="actions">
                <button className="icon-btn" onClick={() => openEdit(c)} aria-label="تعديل"><Icon name="edit" size={16} /></button>
                <button className="icon-btn danger" onClick={() => del(c)} aria-label="حذف"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <FormModal size="lg" title={form.id ? 'تعديل الاتصال' : 'اتصال قرآني جديد'} onClose={() => setForm(null)} onSubmit={save} saving={saving}>
          <div className="form-grid">
            <Field label="القارئ (من)" required>
              <Combobox value={form.from_person_id} opts={pOpts} onChange={v => set('from_person_id', v)} />
            </Field>
            <Field label="قرأ على" required>
              <Combobox value={form.to_person_id} opts={shaykhOpts} onChange={v => set('to_person_id', v)} />
            </Field>
          </div>

          <div className="section-label">ما قُرئ في هذا الاتصال</div>
          {form.items.length === 0 && <div className="callout" style={{ marginBottom: 8 }}>بلا تحديد — الاتصال مطلق ويشمل كل القراءات.</div>}
          {form.items.map((item, i) => (
            <div key={i} className="scope-row">
              <Field label="القراءة">
                <select className="select" value={item.qiraa_id} onChange={e => updateItem(i, 'qiraa_id', e.target.value)}>
                  <option value="">— الكل —</option>
                  {qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
                </select>
              </Field>
              <Field label="الرواية">
                <select className="select" value={item.riwaya_id} onChange={e => updateItem(i, 'riwaya_id', e.target.value)}>
                  <option value="">— الكل —</option>
                  {riwayat.filter(r => !item.qiraa_id || String(r.qiraa_id) === item.qiraa_id).map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                </select>
              </Field>
              <Field label="الطريق">
                <select className="select" value={item.tariq_id} onChange={e => updateItem(i, 'tariq_id', e.target.value)} disabled={!item.riwaya_id}>
                  <option value="">— الكل —</option>
                  {turuq.filter(t => String(t.riwaya_id) === item.riwaya_id).map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
                </select>
              </Field>
              <button type="button" className="icon-btn danger" onClick={() => removeItem(i)} aria-label="إزالة"><Icon name="x" size={16} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} style={{ marginBottom: 14 }}>
            <Icon name="plus" size={14} /> إضافة قراءة / رواية
          </button>

          <div className="section-label">تفاصيل الإجازة</div>
          <div className="form-grid">
            <Field label="طريقة التحمل"><Select form={form} set={set} name="transmission_type_id" options={rowOptions(txTypes)} /></Field>
            <div className="field">
              <span className="field-label">الوسيلة</span>
              <div className="segmented" style={{ width: '100%' }}>
                {MODES.map(m => (
                  <button type="button" key={m} className={form.meeting_mode === m ? 'active' : ''} style={{ flex: 1 }}
                    onClick={() => set('meeting_mode', m)}>{m}</button>
                ))}
              </div>
            </div>
            <Field label="عدد الختمات"><TextInput form={form} set={set} name="khatmat_count" type="number" min="1" /></Field>
            <Field label="تاريخ الإجازة (هجري)"><TextInput form={form} set={set} name="ijaza_date" placeholder="1444هـ" /></Field>
          </div>
          <ReadingModeField tx={form.transmission_type_id} value={form.reading_mode} onChange={v => set('reading_mode', v)} />
          <Field label="ملاحظات التلاوة"><TextArea form={form} set={set} name="notes" rows={2} placeholder="أجازني بالغنة والتحقيق…" /></Field>
          <Field label="وصف عام"><TextArea form={form} set={set} name="description" rows={2} placeholder="ختمت عليه في رمضان 1444هـ بمنزله…" /></Field>
        </FormModal>
      )}
    </>
  );
}
