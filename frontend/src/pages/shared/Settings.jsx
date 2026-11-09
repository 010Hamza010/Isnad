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

// a fixed chain to preview rendering (person ids are placeholders; transmissions are kinds)
const SAMPLE_CHAINS = [
  [
    { from_person_id: 0, to_person_id: 1, to_name: 'محمد عبد الحي الكتاني', to_death_year: '1382', tx_kind: 'qiraa' },
    { from_person_id: 1, to_person_id: 2, to_name: 'جعفر الكتاني', to_death_year: '1323', tx_kind: 'sama' },
    { from_person_id: 2, to_person_id: 3, to_name: 'إدريس العراقي', tx_kind: 'ijaza' },
    { from_person_id: 3, to_person_id: 4, to_name: 'المؤلف', tx_kind: null },
  ],
  [
    { from_person_id: 0, to_person_id: 5, to_name: 'محمد بن عبد الكبير', tx_kind: 'sama_reading' },
    { from_person_id: 5, to_person_id: 3, to_name: 'إدريس العراقي', tx_kind: null },
    { from_person_id: 3, to_person_id: 4, to_name: 'المؤلف', tx_kind: null },
  ],
];

const STATUS = {
  matched:   { color: 'var(--success)', label: 'موجود' },
  ambiguous: { color: 'var(--accent)',  label: 'محتمل' },
  new:       { color: 'var(--info)',    label: 'جديد' },
  relative:  { color: 'var(--purple)',  label: 'قرابة — حدّده يدوياً' },
};

const EMPTY_KW = { word: '', abbr: '', variants: [], kind: null, preferred: false };

export default function Settings() {
  const { toast, notifyError, confirm } = useUI();
  const { data, loading, setData } = useLoad(async () => {
    const [s, t] = await Promise.all([api.get('/isnad-text/settings'), api.get('/tx-types')]);
    return { saved: s.data.settings, kinds: s.data.kinds, txTypes: t.data };
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
  const setPhrase = (which, tx, v) => setDraft(d => ({ ...d, phrases: { ...d.phrases, [which]: { ...(d.phrases[which] || {}), [tx]: v } } }));
  const setKw = (i, patch) => setDraft(d => {
    const keywords = d.keywords.map((k, j) => (j === i ? { ...k, ...patch } : k));
    // one preferred form per transmission kind
    if (patch.preferred) keywords.forEach((k, j) => {
      if (j !== i && (k.kind ?? null) === (keywords[i].kind ?? null)) keywords[j] = { ...k, preferred: false };
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

  const kindLabel = kind => data.kinds.find(k => k.key === kind)?.label;
  const KIND_ROWS = [{ key: 'null', label: 'عنعنة / غير محدد' }, ...data.kinds];

  // which transmission kind each of this database's types means (guessed from its name unless set)
  const setTypeKind = async (t, kind) => {
    try {
      await api.put(`/tx-types/${t.id}/kind`, { kind: kind || null });
      const { data: types } = await api.get('/tx-types');
      setData(d => ({ ...d, txTypes: types }));
      toast(kind ? `«${t.name_ar}» = ${kindLabel(kind)}` : `«${t.name_ar}»: يُستنتج من الاسم`);
    } catch (e) { notifyError(e); }
  };

  return (
    <>
      <section className="card settings-section">
        <div className="card-head">
          <Icon name="layers" />
          <div className="card-title">طرق التحمل في قاعدتك</div>
          <span className="muted">يُستنتج معنى كل طريقة من اسمها؛ صحّحه إن لزم — عليه يقوم الترتيب والعبارات والألوان</span>
        </div>
        <div className="kw-head tx-grid"><span>الاسم</span><span>المعنى</span><span /></div>
        {data.txTypes.map(t => (
          <div key={t.id} className="kw-row tx-grid">
            <span className="strong">{t.name_ar}</span>
            <select className="select" value={t.kind_auto ? '' : t.kind ?? ''} onChange={e => setTypeKind(t, e.target.value)}
              aria-label={`معنى ${t.name_ar}`}>
              <option value="">{t.kind ? `تلقائي: ${kindLabel(t.kind)}` : 'تلقائي: غير معروف'}</option>
              {data.kinds.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <span className="small muted">{t.kind ? '' : '⚠ لم يُعرف — اختر المعنى'}</span>
          </div>
        ))}
        <div style={{ height: 10 }} />
      </section>

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
            <select className="select" value={k.kind ?? ''} aria-label="طريقة التحمل"
              onChange={e => setKw(i, { kind: e.target.value || null, preferred: false })}>
              <option value="">عنعنة / غير محدد</option>
              {data.kinds.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button type="button" className={`icon-btn star${k.preferred ? ' on' : ''}`} onClick={() => setKw(i, { preferred: true })}
              title={k.preferred ? `الصيغة المعتمدة لـ«${kindLabel(k.kind) || 'العنعنة'}»` : 'اعتمدها عند الكتابة'}
              aria-pressed={k.preferred}>
              <Icon name="star" size={16} fill={k.preferred ? 'currentColor' : 'none'} />
            </button>
            <button type="button" className="icon-btn danger" aria-label="حذف" title="حذف" onClick={() => setDraft(d => ({ ...d, keywords: d.keywords.filter((_, j) => j !== i) }))}>
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
              <Field label="… إذا كانت شيخة" hint="مثل: شيختنا">
                <input className="input" value={draft.style.firstTitleF ?? ''} onChange={e => setStyle('firstTitleF', e.target.value)} />
              </Field>
              <Field label="رمز التحويل"><input className="input" value={draft.style.tahwil} onChange={e => setStyle('tahwil', e.target.value)} /></Field>
            </div>
            <div className="field">
              <span className="field-label">عند التقاء الأسانيد بعد «ح»</span>
              <Segmented value={draft.style.tahwilMeet ?? 'repeat'} onChange={v => setStyle('tahwilMeet', v)} options={[
                { value: 'repeat', label: 'يُذكر الملتقى في كل طريق: «… عن ج ح … عن ج»' },
                { value: 'joined', label: '«كلاهما عن ج»' },
              ]} />
            </div>
            <div className="form-grid">
              <Field label="بعد سند طويل: «ح» ثم سطر جديد يبدأ بـ" hint="يبقى «ح» في آخر السطر، ثم «وأرويه أيضاً: قرأتُ على…» إذا بدأ الطريق مني، و«ويرويه/وترويه أيضاً فلان» إذا بدأ من شيخ في وسط السند — اتركه فارغاً لاستعمال «ح و…» دائماً">
                <input className="input" value={draft.style.longRestart ?? ''} onChange={e => setStyle('longRestart', e.target.value)} />
              </Field>
              <Field label="يُعدّ السند طويلاً من (كلمة)">
                <input className="input" type="number" min="5" max="500" value={draft.style.longRestartWords ?? 30}
                  onChange={e => setStyle('longRestartWords', Number(e.target.value))} />
              </Field>
            </div>
            <p className="field-hint" style={{ marginTop: -4, marginBottom: 12 }}>
              إذا قرأتَ على شيخين بالطريقة نفسها وكلاهما عن شيخ واحد، يُكتبان معاً بلا «ح»: «قرأتُ على شيخنا فلان، وشيخنا فلان، كلاهما قرأ على…».
            </p>
            <Field label="لقب مؤلف المتن في آخر السند" hint="«عن المؤلف فلان» — اتركه فارغاً لحذفه">
              <input className="input" value={draft.style.authorTitle ?? ''} onChange={e => setStyle('authorTitle', e.target.value)} />
            </Field>
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
          <span className="muted">
            تحلّ محل الصيغة عند تفعيلها — ضع {'{الاسم}'} مكان اسم الشيخ، واتركها فارغة لاستعمال الصيغة.
            للمذكر والمؤنث: {'{الراوي:وهو قرأ|وهي قرأت}'} حسب الراوي، و{'{الشيخ:أجاز|أجازت}'} حسب الشيخ.
            في العمود الأخير ضع {'{الراوي}'} مكان اسم الشيخ المذكور قبلُ: «ح وقرأ شيخنا فلان أيضاً على…».
          </span>
        </div>
        <div className="kw-head phrase-grid">
          <span>طريقة التحمل</span><span>في اتصالي أنا</span><span>في اتصالات من فوقي</span><span>بعد «كلاهما»</span><span>طريق آخر لشيخ مذكور</span>
        </div>
        {KIND_ROWS.map(t => (
          <div key={t.key} className="kw-row phrase-grid">
            <span className="small strong">{t.label}</span>
            <input className="input" value={draft.phrases.first[t.key] ?? ''} placeholder="قرأتُ على {الاسم}" aria-label={`${t.label} — اتصالي`}
              onChange={e => setPhrase('first', t.key, e.target.value)} />
            <input className="input" value={draft.phrases.others[t.key] ?? ''} placeholder="وهو قرأ على {الاسم}" aria-label={`${t.label} — من فوقي`}
              onChange={e => setPhrase('others', t.key, e.target.value)} />
            <input className="input" value={draft.phrases.joined?.[t.key] ?? ''} placeholder="عن {الاسم}" aria-label={`${t.label} — بعد كلاهما`}
              onChange={e => setPhrase('joined', t.key, e.target.value)} />
            <input className="input" value={draft.phrases.also?.[t.key] ?? ''} placeholder="قرأ {الراوي} أيضاً على {الاسم}" aria-label={`${t.label} — طريق آخر`}
              title="بعد «ح» إذا بدأ الطريق من شيخ ذُكر قبل: {الراوي} هو الشيخ المذكور"
              onChange={e => setPhrase('also', t.key, e.target.value)} />
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
