import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI, errorMessage } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { SkeletonList } from '../../components/ui/EmptyState';
import { rowOptions } from '../../utils/options';
import { buildReview, unresolved, toImportChains, pickOptions } from '../../utils/fastEntry';

const STATUS = {
  matched:   { color: 'var(--success)', label: 'موجود' },
  ambiguous: { color: 'var(--accent)',  label: 'محتمل — اختر' },
  new:       { color: 'var(--info)',    label: 'جديد' },
  relative:  { color: 'var(--purple)',  label: 'قرابة — حدّده' },
};
const EMPTY_ITEM = { qiraa_id: '', riwaya_id: '', tariq_id: '' };

/** Paste an isnad → review each name → dry-run plan → save persons and connections in one go. */
export default function FastEntry() {
  const { toast, notifyError } = useUI();
  const { data, loading, reload } = useLoad(async () => {
    const [p, m, q, r, t, s] = await Promise.all([
      api.get('/persons'), api.get('/mutoon'),
      api.get('/quran/qiraat'), api.get('/quran/riwayat'), api.get('/quran/turuq'),
      api.get('/isnad-text/settings'),
    ]);
    return { persons: p.data, mutoon: m.data, qiraat: q.data, riwayat: r.data, turuq: t.data, kinds: s.data.kinds };
  }, [], null);

  const [target, setTarget] = useState('matn');
  const [matnId, setMatnId] = useState('');
  const [item, setItem]     = useState(EMPTY_ITEM);
  const [text, setText]     = useState('');
  const [review, setReview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [plan, setPlan]     = useState(null);
  const [planErr, setPlanErr] = useState('');
  const [busy, setBusy]     = useState(false);

  const left = review ? unresolved(review) : [];
  const scope = () => ({
    target: target === 'quran' ? 'quran' : 'matn',               // 'general' = matn connections valid for every matn
    matn_id: target === 'matn' ? Number(matnId) || null : null,
    items: target === 'quran' && (item.qiraa_id || item.riwaya_id || item.tariq_id)
      ? [{ qiraa_id: item.qiraa_id || null, riwaya_id: item.riwaya_id || null, tariq_id: item.tariq_id || null }] : [],
  });

  const analyse = async () => {
    if (!text.trim()) return toast('الصق نص الإسناد أولاً', 'error');
    setBusy(true);
    try {
      const { data: out } = await api.post('/isnad-text/parse', { text });
      setReview(buildReview(out.chains));
      setWarnings(out.warnings || []);
    } catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };

  // preview what will be written whenever the choices or target change
  useEffect(() => {
    setPlan(null); setPlanErr('');
    if (!review || left.length || !review.chains.length) return;
    let alive = true;
    api.post('/isnad-text/import', { ...scope(), chains: toImportChains(review), dry_run: true })
      .then(r => alive && setPlan(r.data.plan))
      .catch(e => alive && setPlanErr(errorMessage(e)));
    return () => { alive = false; };
  }, [review, target, matnId, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPick = (key, pick) => setReview(r => ({ ...r, names: { ...r.names, [key]: { ...r.names[key], pick } } }));

  const save = async () => {
    if (target === 'matn' && !matnId) return toast('اختر المتن', 'error');
    setBusy(true);
    try {
      const { data: out } = await api.post('/isnad-text/import', { ...scope(), chains: toImportChains(review) });
      const r = out.result;
      toast(`تم: ${r.persons_created} شخص جديد، ${r.connections_created} اتصال${r.connections_skipped ? `، وتُرك ${r.connections_skipped} موجود` : ''}`);
      setText(''); setReview(null); setPlan(null); setWarnings([]);
      reload();
    } catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };

  const updateItem = (field, val) => setItem(it => {
    const next = { ...it, [field]: val };
    if (field === 'qiraa_id')  { next.riwaya_id = ''; next.tariq_id = ''; }
    if (field === 'riwaya_id') { next.tariq_id = ''; }
    return next;
  });

  if (loading && !data) return <SkeletonList rows={4} />;
  const { persons, mutoon, qiraat, riwayat, turuq, kinds } = data;
  const kindLabel = k => kinds.find(x => x.key === k)?.label || 'عنعنة';
  const nameOf = ref => (typeof ref === 'number' ? (ref === 0 ? 'أنا' : persons.find(p => p.id === ref)?.name_ar) : null);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div className="card-title spacer">١. الصق الإسناد</div>
          <Segmented value={target} onChange={setTarget} options={[{ value: 'matn', label: 'متن' }, { value: 'general', label: 'عام — لكل المتون' }, { value: 'quran', label: 'قرآن' }]} />
        </div>
        <div className="card-pad">
          {target === 'general' ? (
            <div className="callout" style={{ marginBottom: 12 }}>تُحفظ الاتصالات بلا متن، فتصلح لكل المتون.</div>
          ) : target === 'matn' ? (
            <Field label="المتن" required>
              <Combobox value={matnId} onChange={v => setMatnId(v ?? '')} opts={rowOptions(mutoon, 'title')} placeholder="اختر المتن…" />
            </Field>
          ) : (
            <div className="grid-3">
              <Field label="القراءة">
                <select className="select" value={item.qiraa_id} onChange={e => updateItem('qiraa_id', e.target.value)}>
                  <option value="">— الكل —</option>
                  {qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
                </select>
              </Field>
              <Field label="الرواية">
                <select className="select" value={item.riwaya_id} onChange={e => updateItem('riwaya_id', e.target.value)}>
                  <option value="">— الكل —</option>
                  {riwayat.filter(r => !item.qiraa_id || String(r.qiraa_id) === item.qiraa_id).map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                </select>
              </Field>
              <Field label="الطريق">
                <select className="select" value={item.tariq_id} onChange={e => updateItem('tariq_id', e.target.value)} disabled={!item.riwaya_id}>
                  <option value="">— الكل —</option>
                  {turuq.filter(t => String(t.riwaya_id) === item.riwaya_id).map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
                </select>
              </Field>
            </div>
          )}
          <Field label="نص الإسناد" hint="يبدأ بك: «أخبرنا شيخنا فلان، عن فلان…»، أو باسم شيخ: «فلان، عن فلان…». يُفهم التحويل «ح» و«كلاهما».">
            <textarea className="textarea display" style={{ fontSize: 18, minHeight: 120 }} value={text} onChange={e => setText(e.target.value)} />
          </Field>
          <button className="btn btn-primary" onClick={analyse} disabled={busy}><Icon name="search" size={16} /> تحليل</button>
        </div>
      </section>

      {review && (
        <section className="card">
          <div className="card-head">
            <div className="card-title spacer">٢. راجع الأسماء</div>
            {left.length > 0 && <span className="badge badge-accent">{left.length} بانتظار التحديد</span>}
          </div>
          <div className="card-pad">
            {warnings.map((w, i) => <div key={i} className="alert alert-error" style={{ marginBottom: 8 }}>{w}</div>)}
            {review.chains.map((c, ci) => (
              <div key={ci} className="card" style={{ marginBottom: 10 }}>
                <div className="card-head">
                  <span className="badge badge-primary">{ci + 1}</span>
                  <span className="small muted">{c.start ? `يبدأ بـ ${review.names[c.start].name}` : 'يبدأ بك'}</span>
                </div>
                <div style={{ padding: '4px 18px 10px' }}>
                  {[...(c.start ? [{ key: c.start, start: true }] : []), ...c.links].map((l, li) => {
                    const n = review.names[l.key];
                    const st = STATUS[n.status];
                    return (
                      <div key={li} className="parsed-link">
                        {l.start ? <span className="badge">البداية</span> : <span className="badge" title={kindLabel(l.tx_kind)}>{l.keyword}</span>}
                        <span className="strong">{n.name}</span>
                        {n.death_year && <span className="small muted">(ت {n.death_year})</span>}
                        <span className="status-dot" style={{ background: st.color }} />
                        <span className="tiny" style={{ color: st.color }}>{st.label}</span>
                        <div className="spacer" style={{ minWidth: 220 }}>
                          <Combobox value={n.pick ?? ''} onChange={v => setPick(l.key, v ?? null)} opts={pickOptions(n, persons)}
                            placeholder="اختر الشخص…" invalid={n.pick == null} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {review && left.length === 0 && (
        <section className="card">
          <div className="card-head"><div className="card-title spacer">٣. ما سيُحفظ</div></div>
          <div className="card-pad">
            {planErr && <div className="alert alert-error">{planErr}</div>}
            {!plan && !planErr && <div className="skeleton" style={{ height: 80 }} />}
            {plan && (
              <>
                {plan.persons.length > 0 && (
                  <p className="small" style={{ marginBottom: 8 }}>
                    أشخاص جدد: {plan.persons.map(p => <span key={p.key} className="badge badge-accent" style={{ marginInlineEnd: 4 }}>{p.name_ar}{p.death_year ? ` (ت ${p.death_year})` : ''}</span>)}
                  </p>
                )}
                {plan.edges.map((e, i) => (
                  <div key={i} className="parsed-link" style={e.exists ? { opacity: 0.55 } : undefined}>
                    <span className="strong">{e.from_name || nameOf(e.from)}</span>
                    <Icon name="arrow" size={14} />
                    <span className="strong">{e.to_name || nameOf(e.to)}</span>
                    <span className="badge">{kindLabel(e.tx_kind)}{e.tx_kind && !e.transmission_type_id ? ' — لا نوع مطابق في قاعدتك' : ''}</span>
                    {e.exists && <span className="tiny muted">موجود — لن يُكرَّر</span>}
                  </div>
                ))}
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={save} disabled={busy || (target === 'matn' && !matnId) || plan.edges.every(e => e.exists)}>
                    <Icon name="save" size={16} /> حفظ {plan.edges.filter(e => !e.exists).length} اتصال
                  </button>
                  {target === 'matn' && !matnId && <span className="small muted">اختر المتن أولاً</span>}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
