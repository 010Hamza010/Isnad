import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, Select } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import ReadingModeField, { isReadingKind, READING_LABELS } from '../../components/isnad/ReadingMode';
import { matches, isMe } from '../../utils/text';
import { personOptions, rowOptions, kindOfType } from '../../utils/options';
import { scopeOptions, itemLabel, itemKey, addItem, completeItem, linkMatchesScope, findDuplicate } from '../../utils/quranScope';

const MODES = ['حضوراً', 'عن بُعد', 'مختلط'];
const EMPTY = {
  from_person_id: 0, to_person_id: '', transmission_type_id: '', khatmat_count: 1,
  ijaza_date: '', meeting_mode: 'حضوراً', reading_mode: '', notes: '', description: '', items: [],
};

// Same tabs as the matn links. Mine: one card per shaykh. Above: grouped by the student.
const TABS = [
  { value: 'from_me', label: 'شيوخي',        test: c => isMe(c.from_person_id) },
  { value: 'others',  label: 'سلاسل الشيوخ', test: c => !isMe(c.from_person_id) && !isMe(c.to_person_id) },
];

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
  const lists = useMemo(() => ({ qiraat, riwayat, turuq }), [qiraat, riwayat, turuq]);

  const [tab, setTab]         = useState('from_me');
  const [scope, setScope]     = useState('');      // filter: «q<id>» or «r<id>»
  const [query, setQuery]     = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pOpts = useMemo(() => personOptions(persons, { includeMe: true }), [persons]);
  const shaykhOpts = useMemo(() => personOptions(persons), [persons]);
  const scopeOpts = useMemo(() => scopeOptions(lists), [lists]);
  const pName = pid => (isMe(pid) ? 'أنا' : persons.find(p => p.id === Number(pid))?.name_ar || `#${pid}`);
  const current = TABS.find(t => t.value === tab);

  const inScope = c => linkMatchesScope(c, scope, lists);
  const found = c => matches(query, c.from_name, c.to_name, isMe(c.from_person_id) ? 'أنا' : '',
    ...(c.items || []).map(it => itemLabel(it, lists)));
  const visible = conns.filter(inScope).filter(current.test).filter(found);
  const counts = Object.fromEntries(TABS.map(t => [t.value, conns.filter(inScope).filter(t.test).length]));

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach(c => {
      const key = Number(c.from_person_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return [...map.entries()].map(([pid, items]) => ({ pid, name: pName(pid), items }))
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'ar'));
  }, [visible, persons]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = (from = tab === 'others' ? '' : 0) => setForm({ ...EMPTY, from_person_id: from, items: [] });
  const openEdit = c => setForm({
    ...EMPTY, id: c.id,
    from_person_id: c.from_person_id, to_person_id: c.to_person_id,
    transmission_type_id: c.transmission_type_id ?? '', khatmat_count: c.khatmat_count ?? 1,
    ijaza_date: c.ijaza_date ?? '', meeting_mode: c.meeting_mode || 'حضوراً', reading_mode: c.reading_mode ?? '',
    notes: c.notes ?? '', description: c.description ?? '',
    items: (c.items || []).map(it => completeItem(it, lists)),
  });

  const duplicate = form ? findDuplicate(conns, form) : null;

  // again: keep everything but the shaykh, for the next link
  const save = async (again = false) => {
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
        reading_mode:         isReadingKind(kindOfType(txTypes, form.transmission_type_id)) ? form.reading_mode || null : null,
        notes:                form.notes || null,
        description:          form.description || null,
        items:                form.items,
      };
      if (form.id) await api.put(`/quran-connections/${form.id}`, payload);
      else await api.post('/quran-connections', payload);
      toast(form.id ? 'تم حفظ التعديلات' : `تمت إضافة: ${pName(form.from_person_id)} ← ${pName(form.to_person_id)}`);
      setForm(again ? f => ({ ...f, id: undefined, to_person_id: '' }) : null);
      reload();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const del = async c => {
    const ok = await confirm({ title: 'حذف اتصال', message: `${pName(c.from_person_id)} ← ${pName(c.to_person_id)}`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/quran-connections/${c.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  const row = c => (
    <div key={c.id} className="list-item">
      <div className="list-main">
        <div className="conn">
          <span className={`from${isMe(c.from_person_id) ? ' me' : ''}`}>{pName(c.from_person_id)}</span>
          <span className="arrow"><Icon name="arrow" size={14} /></span>
          <span className="to">{c.to_name || pName(c.to_person_id)}</span>
          {c.tx_name && <span className="badge badge-primary">{c.tx_name}</span>}
        </div>
        <div className="chips" style={{ marginTop: 6, gap: 5 }}>
          {c.items?.length
            ? c.items.map(it => <span key={itemKey(completeItem(it, lists))} className="badge badge-accent" title={itemLabel(it, lists)}>{itemLabel(it, lists, { short: true }) || 'مطلق'}</span>)
            : <span className="badge badge-outline">مطلق — كل ما قُرئ</span>}
          {c.reading_mode && <span className="badge badge-success">{READING_LABELS[c.reading_mode]}</span>}
          {c.meeting_mode && c.meeting_mode !== 'حضوراً' && <span className="badge badge-info"><Icon name="globe" size={12} /> {c.meeting_mode}</span>}
          {c.khatmat_count > 1 && <span className="badge"><Icon name="repeat" size={12} /> {c.khatmat_count} ختمات</span>}
          {c.ijaza_date && <span className="badge badge-purple"><Icon name="calendar" size={12} /> {c.ijaza_date}</span>}
        </div>
        {c.description && <div className="small muted" style={{ marginTop: 4 }}>{c.description}</div>}
      </div>
      <div className="actions">
        <button className="icon-btn" onClick={() => openEdit(c)} aria-label="تعديل" title="تعديل"><Icon name="edit" size={16} /></button>
        <button className="icon-btn danger" onClick={() => del(c)} aria-label="حذف" title="حذف"><Icon name="trash" size={16} /></button>
      </div>
    </div>
  );

  const filtering = query || scope;

  return (
    <>
      <div className="toolbar">
        <Segmented value={tab} onChange={v => { setTab(v); setCollapsed({}); }}
          options={TABS.map(t => ({ value: t.value, label: t.label, count: counts[t.value] }))} />
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => openAdd()}><Icon name="plus" size={16} /> اتصال قرآني</button>
      </div>
      <div className="toolbar">
        <SearchInput className="search" value={query} onChange={setQuery} placeholder="ابحث بالشيخ أو القراءة أو الرواية…" />
        <select className="select" style={{ width: 'auto', minWidth: 200 }} value={scope} onChange={e => setScope(e.target.value)} aria-label="تصفية بالقراءة أو الرواية">
          <option value="">كل القراءات</option>
          {qiraat.map(q => (
            <optgroup key={q.id} label={q.name_ar}>
              <option value={`q${q.id}`}>{q.name_ar} — كلها</option>
              {riwayat.filter(r => Number(r.qiraa_id) === Number(q.id)).map(r => <option key={r.id} value={`r${r.id}`}>{r.name_ar}</option>)}
            </optgroup>
          ))}
        </select>
        {filtering && <span className="small muted">{visible.length} من {counts[tab]}</span>}
      </div>

      {loading && !conns.length ? <SkeletonList /> : visible.length === 0 ? (
        <EmptyState icon="quran" title={filtering ? 'لا توجد اتصالات مطابقة' : 'لا توجد اتصالات قرآنية'}
          subtitle={tab === 'from_me' ? 'سجّل من قرأتَ عليه القرآن، وبأي قراءة ورواية' : 'سجّل على من قرأ شيوخك، حتى تتصل السلسلة بالإمام'}
          action={<button className="btn btn-primary" onClick={() => openAdd()}><Icon name="plus" size={16} /> اتصال قرآني</button>} />
      ) : tab === 'from_me' ? (
        <div className="list">{visible.map(row)}</div>
      ) : (
        <div className="stack">
          {groups.map(g => {
            const open = !collapsed[g.pid];
            return (
              <div key={g.pid} className="card">
                <div className="card-head" style={{ padding: 0, borderBottom: open ? undefined : 'none' }}>
                  <button className="accordion-head card-head" style={{ border: 'none', flex: 1 }} aria-expanded={open}
                    onClick={() => setCollapsed(s => ({ ...s, [g.pid]: open }))}>
                    <Icon name="chevron" size={16} className="chev" />
                    <span className="display strong" style={{ fontSize: 18 }}>{g.name}</span>
                    <span className="badge">{g.items.length}</span>
                  </button>
                  <button className="icon-btn" style={{ marginInlineEnd: 12 }} onClick={() => openAdd(g.pid)}
                    aria-label={`شيخ آخر لـ${g.name}`} title={`شيخ آخر لـ${g.name}`}><Icon name="plus" size={16} /></button>
                </div>
                {open && g.items.map(row)}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <FormModal size="lg" title={form.id ? 'تعديل الاتصال' : 'اتصال قرآني جديد'} onClose={() => setForm(null)}
          onSubmit={() => save(false)} saving={saving}
          extra={form.id ? undefined : { label: 'حفظ وإضافة آخر', onClick: () => save(true) }}>
          <div className="form-grid">
            <Field label="القارئ (من)" required>
              <Combobox value={form.from_person_id} opts={pOpts} onChange={v => set('from_person_id', v)} />
            </Field>
            <Field label="قرأ على" required>
              <Combobox value={form.to_person_id} opts={shaykhOpts} onChange={v => set('to_person_id', v)} />
            </Field>
          </div>
          {duplicate && (
            <div className="callout callout-warn" role="status">
              <Icon name="alert" size={16} />
              <span>هذا الاتصال موجود: {pName(duplicate.from_person_id)} ← {pName(duplicate.to_person_id)}</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => openEdit(duplicate)}>تعديل الموجود</button>
            </div>
          )}

          <div className="section-label">ما قُرئ في هذا الاتصال</div>
          <Combobox value="" opts={scopeOpts} allowClear={false} placeholder="ابحث عن قراءة أو رواية أو طريق…"
            onChange={key => { const o = scopeOpts.find(x => x.value === key); if (o) set('items', addItem(form.items, o.item, lists)); }} />
          <div className="chips scope-chips">
            {form.items.length === 0
              ? <span className="small muted">بلا تحديد — الاتصال مطلق ويشمل كل القراءات.</span>
              : form.items.map((it, i) => (
                <span key={itemKey(it)} className="badge badge-accent scope-chip">
                  {itemLabel(it, lists)}
                  <button type="button" className="chip-x" onClick={() => set('items', form.items.filter((_, j) => j !== i))}
                    aria-label={`إزالة ${itemLabel(it, lists)}`} title="إزالة"><Icon name="x" size={12} /></button>
                </span>
              ))}
          </div>

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
          <ReadingModeField kind={kindOfType(txTypes, form.transmission_type_id)} value={form.reading_mode} onChange={v => set('reading_mode', v)} />
          <Field label="ملاحظات التلاوة"><TextArea form={form} set={set} name="notes" rows={2} placeholder="أجازني بالغنة والتحقيق…" /></Field>
          <Field label="وصف عام"><TextArea form={form} set={set} name="description" rows={2} placeholder="ختمت عليه في رمضان 1444هـ بمنزله…" /></Field>
        </FormModal>
      )}
    </>
  );
}
