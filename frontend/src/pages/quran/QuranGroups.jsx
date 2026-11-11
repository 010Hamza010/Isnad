import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import { scopeOptions, itemLabel, itemKey } from '../../utils/quranScope';

// Groups of qiraat / riwayat («العشر الصغرى», «الحرميان»…): picked as one on a Quran link, named as a
// whole in the text («قرأ القراءات العشر الصغرى على …»). Shown as a tab of «القراءات والروايات».

const EMPTY = { name_ar: '', text_ar: '', description: '', items: [], books: [] };

export default function QuranGroups({ qiraat, riwayat }) {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [g, m] = await Promise.all([api.get('/quran/groups'), api.get('/mutoon')]);
    return { groups: g.data, mutoon: m.data };
  }, [], { groups: [], mutoon: [] });
  const { groups, mutoon } = data;

  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const lists = useMemo(() => ({ qiraat, riwayat, turuq: [] }), [qiraat, riwayat]);
  const memberOpts = useMemo(() => scopeOptions(lists, { withTuruq: false }), [lists]);
  const bookOpts = useMemo(() => mutoon.map(m => ({ value: m.id, label: m.title, sub: m.author_name || undefined })), [mutoon]);
  const bookTitle = id => mutoon.find(m => Number(m.id) === Number(id))?.title || `#${id}`;
  const member = it => (it.riwaya_id ? { qiraa_id: null, riwaya_id: Number(it.riwaya_id) } : { qiraa_id: Number(it.qiraa_id), riwaya_id: null });

  const openAdd  = () => setForm({ ...EMPTY });
  const openEdit = g => setForm({
    id: g.id, name_ar: g.name_ar, text_ar: g.text_ar || '', description: g.description || '',
    items: g.items.map(member), books: g.books.map(b => Number(b.matn_id)),
  });

  const save = async () => {
    if (!form.name_ar.trim()) return toast('اسم المجموعة مطلوب', 'error');
    if (!form.items.length) return toast('اختر قراءات المجموعة أو رواياتها', 'error');
    setSaving(true);
    try {
      const { id, ...payload } = form;
      if (id) await api.put(`/quran/groups/${id}`, payload);
      else await api.post('/quran/groups', payload);
      toast(id ? 'تم حفظ التعديلات' : `تمت إضافة «${form.name_ar}»`);
      setForm(null); reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async g => {
    const ok = await confirm({ title: 'حذف مجموعة', message: `ستُحذف «${g.name_ar}» وتُزال من الاتصالات التي قُرئت بها.`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/quran/groups/${g.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  const addKnown = async () => {
    setAdding(true);
    try {
      const { data: r } = await api.post('/quran/groups/known');
      const lines = [
        r.created.length && `أُضيفت: ${r.created.map(g => g.name_ar).join('، ')}`,
        ...r.created.filter(g => g.missing.length).map(g => `«${g.name_ar}» بلا ${g.missing.join('، ')} — لم أجدها`),
        ...r.skipped.map(g => `لم تُضف «${g.name_ar}»: لم أجد ${g.missing.join('، ')}`),
      ].filter(Boolean);
      toast(lines.join(' · ') || 'المجموعات المعروفة موجودة كلها', r.skipped.length || r.created.some(g => g.missing.length) ? 'error' : 'success');
      reload();
    } catch (e) { notifyError(e); } finally { setAdding(false); }
  };

  const addMember = key => {
    const o = memberOpts.find(x => x.value === key);
    if (!o?.item) return;
    const it = member(o.item);
    if (form.items.some(x => itemKey(x) === itemKey(it))) return;
    set('items', [...form.items, it]);
  };

  return (
    <>
      <div className="toolbar">
        <div className="small muted spacer">تُختار المجموعة دفعة واحدة في الاتصال، وتُذكر في النص باسمها: «قرأ القراءات العشر الصغرى على …».</div>
        <button className="btn btn-secondary" onClick={addKnown} disabled={adding}>
          {adding ? <span className="spinner" /> : <Icon name="star" size={16} />} أضف المجموعات المعروفة
        </button>
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={16} /> مجموعة جديدة</button>
      </div>

      {loading && !groups.length ? <SkeletonList /> : groups.length === 0 ? (
        <EmptyState icon="layers" title="لا توجد مجموعات" subtitle="السبع، العشر الصغرى والكبرى، سما، الحرميان… أو ما تحتاجه"
          action={<button className="btn btn-primary" onClick={addKnown} disabled={adding}><Icon name="star" size={16} /> أضف المجموعات المعروفة</button>} />
      ) : (
        <div className="list">
          {groups.map(g => (
            <div key={g.id} className="list-item">
              <div className="list-main">
                <div className="list-title display" style={{ fontSize: 17 }}>◆ {g.name_ar}</div>
                <div className="list-sub">في النص: «قرأ {g.text_ar || g.name_ar} على …»{g.description ? ` — ${g.description}` : ''}</div>
                <div className="chips" style={{ marginTop: 6, gap: 5 }}>
                  {g.items.map(it => <span key={itemKey(member(it))} className="badge badge-accent">{it.riwaya_name || it.qiraa_name}</span>)}
                  {g.books.map(b => <span key={b.matn_id} className="badge badge-info"><Icon name="book" size={12} /> بمضمن {b.title}</span>)}
                </div>
              </div>
              <div className="actions">
                <button className="icon-btn" onClick={() => openEdit(g)} aria-label="تعديل" title="تعديل"><Icon name="edit" size={16} /></button>
                <button className="icon-btn danger" onClick={() => del(g)} aria-label="حذف" title="حذف"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <FormModal size="lg" title={form.id ? 'تعديل المجموعة' : 'مجموعة جديدة'} onClose={() => setForm(null)} onSubmit={save} saving={saving}>
          <div className="form-grid">
            <Field label="الاسم" required><TextInput form={form} set={set} name="name_ar" placeholder="العشر الصغرى" /></Field>
            <Field label="في النص" hint={`«قرأ ${form.text_ar || form.name_ar || '…'} على …»`}>
              <TextInput form={form} set={set} name="text_ar" placeholder={form.name_ar || 'القراءات العشر الصغرى'} />
            </Field>
          </div>

          <div className="section-label">القراءات والروايات <span className="req">*</span></div>
          <Combobox value="" opts={memberOpts.filter(o => !form.items.some(x => itemKey(x) === itemKey(member(o.item))))} allowClear={false}
            placeholder="ابحث عن قراءة أو رواية…" onChange={addMember} />
          <div className="chips scope-chips">
            {form.items.length === 0 && <span className="small muted">قراءة كاملة، أو رواية بعينها.</span>}
            {form.items.map(it => (
              <span key={itemKey(it)} className="badge badge-accent scope-chip">
                {itemLabel(it, lists)}
                <button type="button" className="chip-x" onClick={() => set('items', form.items.filter(x => itemKey(x) !== itemKey(it)))}
                  aria-label={`إزالة ${itemLabel(it, lists)}`} title="إزالة"><Icon name="x" size={12} /></button>
              </span>
            ))}
          </div>

          <div className="section-label">الكتب المقروء بمضمنها <span className="muted small" style={{ fontWeight: 400 }}>— تُضاف إلى الاتصال مع المجموعة</span></div>
          <Combobox value="" opts={bookOpts.filter(o => !form.books.includes(Number(o.value)))} allowClear={false}
            placeholder="الشاطبية، الدرة، الطيبة…" onChange={id => id !== '' && set('books', [...form.books, Number(id)])} />
          <div className="chips scope-chips">
            {form.books.map(id => (
              <span key={id} className="badge badge-info scope-chip">
                بمضمن {bookTitle(id)}
                <button type="button" className="chip-x" onClick={() => set('books', form.books.filter(x => x !== id))}
                  aria-label={`إزالة ${bookTitle(id)}`} title="إزالة"><Icon name="x" size={12} /></button>
              </span>
            ))}
          </div>

          <Field label="وصف"><TextArea form={form} set={set} name="description" rows={2} /></Field>
        </FormModal>
      )}
    </>
  );
}
