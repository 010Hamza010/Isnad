import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI, errorMessage } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { readJsonFile } from '../../utils/download';
import { pickOptions, NEW } from '../../utils/fastEntry';
import { rowOptions } from '../../utils/options';

const STATUS = {
  linked:    { color: 'var(--success)', label: 'معروف من قبل' },
  matched:   { color: 'var(--success)', label: 'موجود' },
  ambiguous: { color: 'var(--accent)',  label: 'محتمل — اختر' },
  new:       { color: 'var(--info)',    label: 'جديد' },
};
const ROLE = { sender: 'المُرسِل (شيخك)', author: 'المؤلف' };
const EMPTY_ITEM = { qiraa_id: '', riwaya_id: '', tariq_id: '' };
const str = v => (v == null ? '' : String(v));

/** Import an isnad exported from another instance: review who is who, choose where it goes, save. */
export default function ShareIsnad({ onImported }) {
  const { toast, notifyError } = useUI();
  const { data: lists } = useLoad(async () => {
    const [p, m, q, r, t] = await Promise.all([
      api.get('/persons'), api.get('/mutoon'), api.get('/quran/qiraat'), api.get('/quran/riwayat'), api.get('/quran/turuq'),
    ]);
    return { persons: p.data.filter(x => x.id !== 0), mutoon: m.data, qiraat: q.data, riwayat: r.data, turuq: t.data };
  }, [], null);

  const fileRef = useRef(null);
  const [file, setFile] = useState(null);       // the received file
  const [prev, setPrev] = useState(null);       // server preview
  const [picks, setPicks] = useState({});
  const [kind, setKind] = useState('matn');
  const [matnId, setMatnId] = useState('');
  const [item, setItem] = useState(EMPTY_ITEM);
  // Quran: the file's books / groups found here (by name), put on the links created; unticked = left out
  const [extra, setExtra] = useState({ books: [], groups: [] });
  const [skip, setSkip] = useState(new Set());
  const [linkMe, setLinkMe] = useState(true);
  const [plan, setPlan] = useState(null);
  const [planErr, setPlanErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setPrev(null); setPicks({}); setPlan(null); setPlanErr(''); };

  const open = async f => {
    const data = await readJsonFile(f);
    if (data?.format !== 'isnad-share') { toast('هذا الملف ليس إسناداً مُصدَّراً من «إسناد»', 'error'); return; }
    setBusy(true);
    try {
      const { data: p } = await api.post('/share/preview', { file: data });
      setFile(data); setPrev(p);
      setPicks(Object.fromEntries(p.rows.map(r => [r.ref, r.person_id ?? (r.status === 'new' ? NEW : null)])));
      if (p.file.target.type === 'quran') {
        setKind('quran');
        const s = p.suggest.item || {};
        setItem({ qiraa_id: str(s.qiraa_id), riwaya_id: str(s.riwaya_id), tariq_id: str(s.tariq_id) });
        setExtra({ books: p.suggest.books || [], groups: p.suggest.groups || [] }); setSkip(new Set());
      } else if (p.suggest.matn_id) { setKind('matn'); setMatnId(String(p.suggest.matn_id)); }
      else setKind(p.file.target.title ? 'new_matn' : 'general');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const left = prev ? prev.rows.filter(r => picks[r.ref] == null || picks[r.ref] === '') : [];
  const body = dry => ({
    file, picks, link_me: linkMe, dry_run: dry,
    target: {
      kind, matn_id: kind === 'matn' ? Number(matnId) || null : null, item: kind === 'quran' ? item : null,
      ...(kind === 'quran' ? {
        books: extra.books.filter(b => b.matn_id && !skip.has(`b${b.matn_id}`)).map(b => b.matn_id),
        groups: extra.groups.filter(g => g.group_id && !skip.has(`g${g.group_id}`)).map(g => g.group_id),
      } : {}),
    },
  });
  const toggleSkip = key => setSkip(prevSkip => { const n = new Set(prevSkip); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  // what will be written, whenever a choice changes
  useEffect(() => {
    setPlan(null); setPlanErr('');
    if (!prev || left.length || (kind === 'matn' && !matnId)) return;
    let alive = true;
    api.post('/share/import', body(true))
      .then(r => alive && setPlan(r.data.plan))
      .catch(e => alive && setPlanErr(errorMessage(e)));
    return () => { alive = false; };
  }, [prev, picks, kind, matnId, item, linkMe, skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/share/import', body(false));
      const r = data.result;
      toast(`تم الاستيراد: ${r.persons_created} علَماً جديداً، ${r.connections_created} اتصالاً${r.connections_skipped ? `، وتُرك ${r.connections_skipped} موجوداً` : ''}`);
      reset(); onImported?.();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const updateItem = (field, val) => setItem(it => {
    const next = { ...it, [field]: val };
    if (field === 'qiraa_id')  { next.riwaya_id = ''; next.tariq_id = ''; }
    if (field === 'riwaya_id') { next.tariq_id = ''; }
    return next;
  });

  const t = prev?.file.target;
  const nameOf = ref => {
    if (typeof ref === 'number') return ref === 0 ? 'أنا' : lists?.persons.find(p => p.id === ref)?.name_ar || `#${ref}`;
    const r = prev?.rows.find(x => `ref:${x.ref}` === ref);
    return r?.name_ar || ref;
  };
  const newLinks = plan ? plan.edges.filter(e => !e.exists).length : 0;

  return (
    <section className="card settings-section">
      <div className="card-head">
        <Icon name="link" /><div className="card-title">استيراد إسناد من شيخ</div>
        <span className="muted">ملف «تصدير للمشاركة» من صفحة الأسانيد في نسخة أخرى</span>
      </div>
      <div className="card-pad stack">
        {!prev && (
          <>
            <div className="small muted">
              تُطابَق الأسماء بأعلامك ولو اختلفت أرقامها، وما تختاره يُحفظ فيُعرف تلقائياً في الاستيراد القادم من النسخة نفسها.
              لتصدير إسنادك: افتح «أسانيد المتون» أو «أسانيد القرآن» واضغط «تصدير للمشاركة».
            </div>
            <div>
              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy || !lists}>
                {busy ? <span className="spinner" /> : <><Icon name="plus" size={14} /> اختر ملف الإسناد…</>}
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) open(f); }} />
            </div>
          </>
        )}

        {prev && (
          <>
            <div className="row row-wrap" style={{ gap: 8 }}>
              <span>من <b>{prev.file.from}</b></span>
              <span className="badge badge-primary">{t.type === 'matn' ? t.title || 'متن' : [t.qiraa, t.riwaya, t.tariq].filter(Boolean).join(' · ') || 'القرآن'}</span>
              <span className="badge">{prev.counts.routes} طرق · {prev.counts.persons} علَماً</span>
              {prev.file.exported_at && <span className="small muted">{new Date(prev.file.exported_at).toLocaleDateString('ar')}</span>}
              <div className="spacer" />
              <button className="btn btn-ghost btn-sm" onClick={reset}>إلغاء</button>
            </div>

            <div className="section-label">١. من هو كل علَم عندك؟ {left.length > 0 && <span className="badge badge-accent">{left.length} بانتظار التحديد</span>}</div>
            <div>
              {prev.rows.map(r => {
                const st = STATUS[r.status];
                return (
                  <div key={r.ref} className="parsed-link">
                    {r.role && <span className="badge badge-primary">{ROLE[r.role]}</span>}
                    <span className="strong">{r.name_ar}</span>
                    {r.death_year && <span className="small muted">(ت {r.death_year})</span>}
                    <span className="status-dot" style={{ background: st.color }} />
                    <span className="tiny" style={{ color: st.color }}>{st.label}</span>
                    <div className="spacer" style={{ minWidth: 220 }}>
                      <Combobox value={picks[r.ref] ?? ''} onChange={v => setPicks(p => ({ ...p, [r.ref]: v ?? null }))}
                        opts={pickOptions({ name: r.name_ar, death_year: r.death_year, candidates: r.candidates }, lists?.persons || [])}
                        placeholder="اختر العلَم…" invalid={picks[r.ref] == null} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="section-label">٢. أين يُحفظ؟</div>
            <Segmented value={kind} onChange={setKind} options={[
              { value: 'matn', label: 'متن موجود' },
              ...(t.type === 'matn' && t.title ? [{ value: 'new_matn', label: `متن جديد: ${t.title}` }] : []),
              { value: 'general', label: 'عام — لكل المتون' },
              { value: 'quran', label: 'قرآن' },
            ]} />
            {kind === 'matn' && (
              <Field label="المتن" required>
                <Combobox value={matnId} onChange={v => setMatnId(v ?? '')} opts={rowOptions(lists?.mutoon || [], 'title')} placeholder="اختر المتن…" />
              </Field>
            )}
            {kind === 'quran' && lists && (
              <div className="grid-3">
                <Field label="القراءة">
                  <select className="select" value={item.qiraa_id} onChange={e => updateItem('qiraa_id', e.target.value)}>
                    <option value="">— الكل —</option>
                    {lists.qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
                  </select>
                </Field>
                <Field label="الرواية">
                  <select className="select" value={item.riwaya_id} onChange={e => updateItem('riwaya_id', e.target.value)}>
                    <option value="">— الكل —</option>
                    {lists.riwayat.filter(r => !item.qiraa_id || String(r.qiraa_id) === item.qiraa_id).map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                  </select>
                </Field>
                <Field label="الطريق">
                  <select className="select" value={item.tariq_id} onChange={e => updateItem('tariq_id', e.target.value)} disabled={!item.riwaya_id}>
                    <option value="">— الكل —</option>
                    {lists.turuq.filter(x => String(x.riwaya_id) === item.riwaya_id).map(x => <option key={x.id} value={x.id}>{x.name_ar}</option>)}
                  </select>
                </Field>
              </div>
            )}
            {kind === 'quran' && (extra.books.length > 0 || extra.groups.length > 0) && (
              <div className="field">
                <span className="field-label">قُرئ مع</span>
                <div className="row row-wrap" style={{ gap: 10 }}>
                  {extra.groups.map(g => (g.group_id ? (
                    <label key={`g${g.name_ar}`} className="check small">
                      <input type="checkbox" checked={!skip.has(`g${g.group_id}`)} onChange={() => toggleSkip(`g${g.group_id}`)} />
                      <span>◆ {g.name_ar}</span>
                    </label>
                  ) : <span key={`g${g.name_ar}`} className="badge" title="أضفها من «المجموعات» ثم أعد فتح الملف">◆ {g.name_ar} — غير موجودة هنا</span>))}
                  {extra.books.map(b => (b.matn_id ? (
                    <label key={`b${b.title}`} className="check small">
                      <input type="checkbox" checked={!skip.has(`b${b.matn_id}`)} onChange={() => toggleSkip(`b${b.matn_id}`)} />
                      <span>بمضمن {b.title}</span>
                    </label>
                  ) : <span key={`b${b.title}`} className="badge" title="أضفه في المتون ثم أعد فتح الملف">بمضمن {b.title} — غير موجود هنا</span>))}
                </div>
              </div>
            )}
            <label className="row small" style={{ gap: 8 }}>
              <input type="checkbox" checked={linkMe} onChange={e => setLinkMe(e.target.checked)} />
              أضف اتصالي بالمُرسِل ({prev.rows.find(r => r.role === 'sender')?.name_ar}) إن لم يكن موجوداً
            </label>

            <div className="section-label">٣. ما سيُحفظ</div>
            {left.length > 0 && <div className="small muted">حدّد الأعلام أولاً.</div>}
            {!left.length && kind === 'matn' && !matnId && <div className="small muted">اختر المتن أولاً.</div>}
            {planErr && <div className="alert alert-error">{planErr}</div>}
            {plan && (
              <>
                {plan.persons.length > 0 && (
                  <p className="small">أعلام جدد: {plan.persons.map(p => <span key={p.key} className="badge badge-accent" style={{ marginInlineEnd: 4 }}>{p.name_ar}</span>)}</p>
                )}
                <details>
                  <summary className="small">{newLinks} اتصالاً جديداً{plan.edges.length > newLinks ? `، و${plan.edges.length - newLinks} موجود لن يُكرَّر` : ''}</summary>
                  {plan.edges.map((e, i) => (
                    <div key={i} className="parsed-link" style={e.exists ? { opacity: 0.55 } : undefined}>
                      <span className="strong">{nameOf(e.from)}</span><Icon name="arrow" size={14} /><span className="strong">{nameOf(e.to)}</span>
                      {e.exists && <span className="tiny muted">موجود</span>}
                    </div>
                  ))}
                </details>
                <div>
                  <button className="btn btn-primary" onClick={save} disabled={busy || !newLinks}>
                    {busy ? <span className="spinner" /> : <><Icon name="save" size={16} /> استيراد {newLinks} اتصالاً</>}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
