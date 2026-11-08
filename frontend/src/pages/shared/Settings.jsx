import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import useDebounced from '../../hooks/useDebounced';
import { useUI, errorMessage } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import TagInput from '../../components/ui/TagInput';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import IsnadProse from '../../components/isnad/IsnadProse';

const SAMPLE_TEXT = 'أخبرنا شيخنا العلامة محمد عبد الحي الكتاني رحمه الله، قال: ثنا أبو المواهب جعفر الكتاني، عن أبيه، أنا إدريس العراقي ح وحدثنا محمد بن عبد الكبير، كلاهما عن المؤلف';

// a fixed chain to preview rendering (ids are placeholders)
const SAMPLE_CHAINS = [
  [
    { from_person_id: 0, to_person_id: 1, to_name: 'محمد عبد الحي الكتاني', to_death_year: '1382', transmission_type_id: 2 },
    { from_person_id: 1, to_person_id: 2, to_name: 'جعفر الكتاني', to_death_year: '1323', transmission_type_id: 1 },
    { from_person_id: 2, to_person_id: 3, to_name: 'إدريس العراقي', transmission_type_id: 3 },
    { from_person_id: 3, to_person_id: 4, to_name: 'المؤلف', transmission_type_id: null },
  ],
  [
    { from_person_id: 0, to_person_id: 5, to_name: 'محمد بن عبد الكبير', transmission_type_id: 10 },
    { from_person_id: 5, to_person_id: 3, to_name: 'إدريس العراقي', transmission_type_id: null },
    { from_person_id: 3, to_person_id: 4, to_name: 'المؤلف', transmission_type_id: null },
  ],
];

const STATUS = {
  matched:   { color: 'var(--success)', label: 'موجود' },
  ambiguous: { color: 'var(--accent)',  label: 'محتمل' },
  new:       { color: 'var(--info)',    label: 'جديد' },
  relative:  { color: 'var(--purple)',  label: 'قرابة — حدّده يدوياً' },
};

const EMPTY_KW = { word: '', abbr: '', variants: [], tx_type_id: null, preferred: false };

export default function Settings() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, setData } = useLoad(async () => {
    const [s, t] = await Promise.all([api.get('/isnad-text/settings'), api.get('/tx-types')]);
    return { saved: s.data.settings, txTypes: t.data };
  }, [], null);

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data && !draft) setDraft(data.saved); }, [data]);

  const dirty = useMemo(() => draft && data && JSON.stringify(draft) !== JSON.stringify(data.saved), [draft, data]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (loading || !draft) return <div className="stack"><div className="skeleton" style={{ height: 300 }} /><div className="skeleton" style={{ height: 160 }} /></div>;

  const setStyle = (k, v) => setDraft(d => ({ ...d, style: { ...d.style, [k]: v } }));
  const setList  = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setPhrase = (which, tx, v) => setDraft(d => ({ ...d, phrases: { ...d.phrases, [which]: { ...d.phrases[which], [tx]: v } } }));
  const setKw = (i, patch) => setDraft(d => {
    const keywords = d.keywords.map((k, j) => (j === i ? { ...k, ...patch } : k));
    // one preferred form per transmission type
    if (patch.preferred) keywords.forEach((k, j) => {
      if (j !== i && String(k.tx_type_id) === String(keywords[i].tx_type_id)) keywords[j] = { ...k, preferred: false };
    });
    return { ...d, keywords };
  });

  const save = async () => {
    setSaving(true);
    try {
      const { data: r } = await api.put('/isnad-text/settings', draft);
      setData(d => ({ ...d, saved: r.settings })); setDraft(r.settings);
      toast('تم حفظ الإعدادات');
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const reset = async () => {
    const ok = await confirm({ title: 'استعادة الإعدادات الافتراضية', message: 'ستُحذف كل الصيغ والخيارات التي عدّلتها.', danger: true, confirmLabel: 'استعادة' });
    if (!ok) return;
    try {
      const { data: r } = await api.delete('/isnad-text/settings');
      setData(d => ({ ...d, saved: r.settings })); setDraft(r.settings);
      toast('تمت الاستعادة');
    } catch (e) { notifyError(e); }
  };

  const txName = id => data.txTypes.find(t => String(t.id) === String(id))?.name_ar;

  return (
    <>
      <section className="card settings-section">
        <div className="card-head">
          <Icon name="text" />
          <div className="card-title">صيغ الأداء</div>
          <span className="muted">تُستعمل لكتابة الأسانيد ولقراءتها من النصوص</span>
        </div>
        <div className="kw-head">
          <span>الصيغة</span><span>المختصرة</span><span>صيغ أخرى تُقرأ</span><span>طريقة التحمل</span>
          <span title="الصيغة المعتمدة عند الكتابة"><Icon name="star" size={14} /></span><span />
        </div>
        {draft.keywords.map((k, i) => (
          <div key={i} className="kw-row">
            <input className="input" value={k.word} placeholder="حدثنا" onChange={e => setKw(i, { word: e.target.value })} aria-label="الصيغة" />
            <input className="input" value={k.abbr || ''} placeholder="ثنا" onChange={e => setKw(i, { abbr: e.target.value })} aria-label="المختصرة" />
            <TagInput value={k.variants || []} onChange={v => setKw(i, { variants: v })} placeholder="حدثني، نا…" />
            <select className="select" value={k.tx_type_id ?? ''} aria-label="طريقة التحمل"
              onChange={e => setKw(i, { tx_type_id: e.target.value === '' ? null : Number(e.target.value), preferred: false })}>
              <option value="">عنعنة / غير محدد</option>
              {data.txTypes.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
            </select>
            <button type="button" className={`icon-btn star${k.preferred ? ' on' : ''}`} onClick={() => setKw(i, { preferred: true })}
              title={k.preferred ? `الصيغة المعتمدة لـ«${txName(k.tx_type_id) || 'العنعنة'}»` : 'اعتمدها عند الكتابة'}
              aria-pressed={k.preferred}>
              <Icon name="star" size={16} fill={k.preferred ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="icon-btn danger" aria-label="حذف" onClick={() => setDraft(d => ({ ...d, keywords: d.keywords.filter((_, j) => j !== i) }))}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        <div style={{ padding: '8px 18px 14px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDraft(d => ({ ...d, keywords: [...d.keywords, { ...EMPTY_KW }] }))}>
            <Icon name="plus" size={14} /> صيغة جديدة
          </button>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card settings-section">
          <div className="card-head"><div className="card-title">أسلوب الكتابة</div></div>
          <div className="card-pad">
            <label className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={draft.style.abbreviate} onChange={e => setStyle('abbreviate', e.target.checked)} />
              استعمل الصيغ المختصرة (ثنا، أنا)
            </label>
            <label className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={draft.style.qala} onChange={e => setStyle('qala', e.target.checked)} />
              أضف «قال:» قبل كل صيغة
            </label>
            <label className="check" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={draft.style.clear} onChange={e => setStyle('clear', e.target.checked)} />
              عبارات صريحة بدل الصيغ (قرأتُ على فلان، وهو سمع من فلان)
            </label>
            <label className="check" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={draft.style.deathYears} onChange={e => setStyle('deathYears', e.target.checked)} />
              تاريخ الوفاة بعد كل اسم (ت …هـ)
            </label>
            <p className="field-hint" style={{ marginBottom: 12 }}>هذه لنص الإسناد في صفحات الأسانيد؛ الإجازات لها خياراتها الخاصة.</p>
            <div className="form-grid">
              <Field label="القراءة عن ظهر قلب" hint="بعد اسم الشيخ في العبارات الصريحة">
                <input className="input" value={draft.style.heartWord} onChange={e => setStyle('heartWord', e.target.value)} />
              </Field>
              <Field label="القراءة من الكتاب">
                <input className="input" value={draft.style.lookingWord} onChange={e => setStyle('lookingWord', e.target.value)} />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="لقب الشيخ المباشر" hint="مثل: شيخنا، شيخي — اتركه فارغاً لحذفه">
                <input className="input" value={draft.style.firstTitle} onChange={e => setStyle('firstTitle', e.target.value)} />
              </Field>
              <Field label="رمز التحويل"><input className="input" value={draft.style.tahwil} onChange={e => setStyle('tahwil', e.target.value)} /></Field>
            </div>
            <div className="field">
              <span className="field-label">الفاصل بين الحلقات</span>
              <Segmented value={draft.style.separator} onChange={v => setStyle('separator', v)}
                options={[{ value: '، ', label: 'فاصلة «،»' }, { value: ' ', label: 'مسافة' }, { value: ' - ', label: 'شَرطة' }]} />
            </div>
          </div>
        </section>

        <section className="card settings-section">
          <div className="card-head"><div className="card-title">التنظيف عند قراءة النصوص</div></div>
          <div className="card-pad">
            <Field label="ألقاب تُحذف من أول الاسم"><TagInput value={draft.titles} onChange={v => setList('titles', v)} /></Field>
            <Field label="عبارات دعاء تُحذف"><TagInput value={draft.honorifics} onChange={v => setList('honorifics', v)} /></Field>
            <Field label="كلمات تُتجاهل"><TagInput value={draft.fillers} onChange={v => setList('fillers', v)} /></Field>
          </div>
        </section>
      </div>

      <section className="card settings-section">
        <div className="card-head">
          <div className="card-title">العبارات الصريحة</div>
          <span className="muted">تحلّ محل الصيغة عند تفعيلها — ضع {'{الاسم}'} مكان اسم الشيخ، واتركها فارغة لاستعمال الصيغة</span>
        </div>
        <div className="kw-head phrase-grid">
          <span>طريقة التحمل</span><span>في اتصالي أنا</span><span>في اتصالات من فوقي</span>
        </div>
        {[{ id: 'null', name_ar: 'عنعنة / غير محدد' }, ...data.txTypes].map(t => (
          <div key={t.id} className="kw-row phrase-grid">
            <span className="small strong">{t.name_ar}</span>
            <input className="input" value={draft.phrases.first[t.id] ?? ''} placeholder="قرأتُ على {الاسم}" aria-label={`${t.name_ar} — اتصالي`}
              onChange={e => setPhrase('first', t.id, e.target.value)} />
            <input className="input" value={draft.phrases.others[t.id] ?? ''} placeholder="وهو قرأ على {الاسم}" aria-label={`${t.name_ar} — من فوقي`}
              onChange={e => setPhrase('others', t.id, e.target.value)} />
          </div>
        ))}
        <div style={{ height: 10 }} />
      </section>

      <Playground settings={draft} />

      {dirty && (
        <div className="savebar" role="status">
          <Icon name="alert" size={16} /><span className="spacer small">لديك تغييرات غير محفوظة</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft(data.saved)}>تراجع</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'حفظ'}</button>
        </div>
      )}
      {!dirty && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={reset}><Icon name="reset" size={14} /> استعادة الافتراضي</button>
        </div>
      )}
    </>
  );
}

/** Live test of both directions with the current (unsaved) settings. */
function Playground({ settings }) {
  const [mode, setMode] = useState('parse');
  const [text, setText] = useState(SAMPLE_TEXT);
  const [out, setOut]   = useState(null);
  const [err, setErr]   = useState('');
  const s = useDebounced(settings, 350);
  const t = useDebounced(text, 350);

  useEffect(() => {
    let alive = true;
    setErr('');
    const req = mode === 'parse'
      ? (t.trim() ? api.post('/isnad-text/parse', { text: t, settings: s }) : Promise.resolve({ data: null }))
      : api.post('/isnad-text/render', { chains: SAMPLE_CHAINS, settings: s });
    req.then(r => alive && setOut(r.data)).catch(e => alive && (setOut(null), setErr(errorMessage(e))));
    return () => { alive = false; };
  }, [mode, t, s]);

  return (
    <section className="card settings-section">
      <div className="card-head">
        <div className="card-title spacer">تجربة</div>
        <Segmented value={mode} onChange={v => { setMode(v); setOut(null); }} options={[
          { value: 'parse', label: 'من نص إلى سند' }, { value: 'render', label: 'من سند إلى نص' },
        ]} />
      </div>
      <div className="card-pad">
        {err && <div className="alert alert-error">{err}</div>}

        {mode === 'render' && (
          <>
            <p className="small muted" style={{ marginBottom: 8 }}>
              سندان تجريبيان يلتقيان عند «إدريس العراقي» — لاحظ التحويل «ح» و«كلاهما»:
            </p>
            {out?.text ? <div className="isnad-text"><IsnadProse text={out.text} /></div> : <div className="skeleton" style={{ height: 80 }} />}
          </>
        )}

        {mode === 'parse' && (
          <>
            <Field label="الصق نص إسناد">
              <textarea className="textarea display" style={{ fontSize: 18, minHeight: 110 }} value={text} onChange={e => setText(e.target.value)} />
            </Field>
            {out?.warnings?.map((w, i) => <div key={i} className="alert alert-error" style={{ marginBottom: 8 }}>{w}</div>)}
            {out?.chains?.map((c, ci) => (
              <div key={ci} className="card" style={{ marginBottom: 10 }}>
                <div className="card-head"><span className="badge badge-primary">{ci + 1}</span><span className="small muted">{c.start ? `يبدأ بـ ${c.start.name}` : 'يبدأ بك'}</span></div>
                <div style={{ padding: '4px 18px 10px' }}>
                  {c.links.map((l, li) => {
                    const st = STATUS[l.status];
                    return (
                      <div key={li} className="parsed-link">
                        <span className="badge">{l.keyword}</span>
                        <span className="strong">{l.name}</span>
                        {l.death_year && <span className="small muted">(ت {l.death_year})</span>}
                        <span className="status-dot" style={{ background: st.color }} />
                        <span className="tiny" style={{ color: st.color }}>{st.label}</span>
                        {l.status === 'ambiguous' && <span className="tiny muted">({l.candidates.slice(0, 3).map(x => x.name_ar).join(' / ')})</span>}
                        {l.status === 'matched' && l.candidates?.[0] && l.candidates[0].name_ar !== l.name && <span className="tiny muted">← {l.candidates[0].name_ar}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {out?.rendered && (
              <>
                <div className="section-label">إعادة الصياغة بإعداداتك</div>
                <div className="isnad-text"><IsnadProse text={out.rendered} /></div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
