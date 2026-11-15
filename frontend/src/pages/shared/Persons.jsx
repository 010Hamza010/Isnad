import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import { FormModal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea } from '../../components/ui/Field';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { personRoles } from '../../utils/personRoles';
import { filterPersons, kindCounts, facets, paginate, pageNumbers, missing, withDeathYear } from '../../utils/personList';

const EMPTY = { name_ar: '', name_latin: '', gender: 'M', kunya: '', nisba: '', century: '', death_year: '', region: '', description: '' };
const SORTS = [{ value: 'name', label: 'الاسم' }, { value: 'death', label: 'سنة الوفاة' }, { value: 'links', label: 'الأكثر روابط' }];

export default function Persons() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [p, q, r] = await Promise.all([api.get('/persons'), api.get('/quran/qiraat'), api.get('/quran/riwayat')]);
    return { persons: p.data, qiraat: q.data, riwayat: r.data };
  }, [], { persons: [], qiraat: [], riwayat: [] });
  const { persons, qiraat, riwayat } = data;

  // Search, filters and page live in the URL: back from a person or a reload lands on the same page.
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') || '', kind: params.get('kind') || 'all', century: params.get('c') || '',
    region: params.get('r') || '', incomplete: params.get('x') === '1', sort: params.get('sort') || 'name',
  };
  const setFilter = (key, value) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (value && value !== 'all' && !(key === 'sort' && value === 'name')) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    return next;
  }, { replace: true });

  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const roles    = useMemo(() => personRoles(qiraat, riwayat), [qiraat, riwayat]);
  const facet    = useMemo(() => facets(persons), [persons]);
  const filtered = useMemo(() => filterPersons(persons, roles, f), [persons, roles, f.q, f.kind, f.century, f.region, f.incomplete, f.sort]);
  const counts   = useMemo(() => kindCounts(persons, roles, f), [persons, roles, f.q, f.century, f.region, f.incomplete]);
  const pg       = paginate(filtered, params.get('page'));
  const narrowed = f.q || f.century || f.region || f.incomplete || f.kind !== 'all';
  const clearAll = () => setParams({}, { replace: true });

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
        <SearchInput className="search" value={f.q} onChange={v => setFilter('q', v)} placeholder="ابحث بالاسم أو الكنية أو النسبة أو البلد…" />
        <button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Icon name="plus" size={16} /> علَم جديد</button>
      </div>
      <div className="toolbar persons-filters">
        <Segmented value={f.kind} onChange={v => setFilter('kind', v)} options={[
          { value: 'all', label: 'الكل', count: counts.all },
          { value: 'imam', label: 'أئمة القراءات', count: counts.imam },
          { value: 'rawi', label: 'الرواة', count: counts.rawi },
          { value: 'others', label: 'غيرهم', count: counts.others },
        ]} />
        <select className="select" value={f.century} onChange={e => setFilter('c', e.target.value)} aria-label="القرن">
          <option value="">كل القرون</option>
          {facet.centuries.map(c => <option key={c.value} value={c.value}>القرن {c.value} ({c.count})</option>)}
        </select>
        <select className="select" value={f.region} onChange={e => setFilter('r', e.target.value)} aria-label="البلد">
          <option value="">كل البلدان</option>
          {facet.regions.map(r => <option key={r.value} value={r.value}>{r.value} ({r.count})</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={f.incomplete} onChange={e => setFilter('x', e.target.checked ? '1' : '')} /> يحتاج إكمالاً
        </label>
        <select className="select" value={f.sort} onChange={e => setFilter('sort', e.target.value)} aria-label="الترتيب">
          {SORTS.map(o => <option key={o.value} value={o.value}>ترتيب: {o.label}</option>)}
        </select>
        {narrowed && <button className="btn btn-ghost btn-sm" onClick={clearAll}>مسح التصفية</button>}
      </div>

      {loading && !persons.length ? <SkeletonList /> : filtered.length === 0 ? (
        <EmptyState icon="users" title={narrowed ? 'لا نتائج مطابقة' : 'لا يوجد أعلام بعد'}
          subtitle={narrowed ? 'جرّب كلمة أخرى أو امسح التصفية' : 'أضف شيخك الأول لتبدأ'}
          action={narrowed
            ? <button className="btn" onClick={clearAll}>مسح التصفية</button>
            : <button className="btn btn-primary" onClick={() => setForm(EMPTY)}><Icon name="plus" size={16} /> إضافة</button>} />
      ) : (
        <>
          <div className="list persons-list">
            {pg.items.map(p => {
              const lacks = missing(p);
              return (
                <div key={p.id} className="list-item" title={p.description || undefined}>
                  <div className="list-main">
                    <div className="row row-wrap" style={{ gap: 6 }}>
                      <span className="list-title">{p.name_ar}</span>
                      {p.kunya && <span className="muted small">({p.kunya})</span>}
                      {p.gender === 'F' && <span className="badge badge-purple">أنثى</span>}
                      {(roles.get(Number(p.id)) || []).map(r => (
                        <span key={r.label} className={`badge ${r.kind === 'imam' ? 'badge-accent' : 'badge-info'}`}>{r.label}</span>
                      ))}
                      <span className="list-sub">
                        {[p.death_year && `ت ${p.death_year}`, p.century && `ق${p.century}`, p.region, p.links_count ? `${p.links_count} رابط` : null].filter(Boolean).join(' · ')}
                      </span>
                      {f.incomplete && lacks.length > 0 && <span className="badge badge-outline">ينقصه: {lacks.join('، ')}</span>}
                    </div>
                  </div>
                  <div className="actions">
                    <button className="icon-btn" onClick={() => openEdit(p)} aria-label="تعديل" title="تعديل"><Icon name="edit" size={16} /></button>
                    <button className="icon-btn danger" onClick={() => del(p)} aria-label="حذف" title="حذف"><Icon name="trash" size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <nav className="pager" aria-label="الصفحات">
            {pg.pages > 1 && <>
              <button className="icon-btn" disabled={pg.page === 1} onClick={() => setFilter('page', String(pg.page - 1))} aria-label="السابقة">‹</button>
              {pageNumbers(pg.page, pg.pages).map((n, i) => n === '…'
                ? <span key={`gap${i}`} className="muted">…</span>
                : <button key={n} className={`chip${n === pg.page ? ' active' : ''}`} aria-current={n === pg.page ? 'page' : undefined}
                    onClick={() => setFilter('page', n === 1 ? '' : String(n))}>{n}</button>)}
              <button className="icon-btn" disabled={pg.page === pg.pages} onClick={() => setFilter('page', String(pg.page + 1))} aria-label="التالية">›</button>
            </>}
            <span className="muted small">{pg.from}–{pg.to} من {pg.total}</span>
          </nav>
        </>
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
            <Field label="سنة الوفاة" hint="يُملأ القرن منها تلقائياً"><TextInput form={form} set={(k, v) => setForm(f => withDeathYear(f, v))} name="death_year" placeholder="852هـ" /></Field>
            <Field label="القرن"><TextInput form={form} set={set} name="century" type="number" min="1" max="15" placeholder="9" /></Field>
            <Field label="البلد / المنطقة"><TextInput form={form} set={set} name="region" placeholder="المغرب" /></Field>
            <Field label="الاسم بالحروف اللاتينية"><TextInput form={form} set={set} name="name_latin" placeholder="Ibn Hajar" dir="ltr" /></Field>
          </div>
          {roles.has(Number(form.id)) && (
            <p className="field-hint">{roles.get(Number(form.id)).map(r => r.label).join('، ')} — يُغيَّر من «القراءات والروايات».</p>
          )}
          <Field label="ترجمة وملاحظات"><TextArea form={form} set={set} name="description" placeholder="ترجمة مختصرة، شيوخه، إجازاته…" /></Field>
        </FormModal>
      )}
    </>
  );
}
