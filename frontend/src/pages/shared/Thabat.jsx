import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI, errorMessage } from '../../components/ui/UIProvider';
import Combobox from '../../components/ui/Combobox';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { downloadFrom, readJsonFile } from '../../utils/download';
import { pickOptions, NEW } from '../../utils/fastEntry';

const STATUS = {
  linked:    { color: 'var(--success)', label: 'معروف من قبل' },
  matched:   { color: 'var(--success)', label: 'موجود' },
  ambiguous: { color: 'var(--accent)',  label: 'محتمل — اختر' },
  new:       { color: 'var(--info)',    label: 'جديد' },
};
const QURAN_KIND = { qiraat: 'قراءة', riwayat: 'رواية', turuq: 'طريق' };
const fmt = n => Number(n || 0).toLocaleString('ar');
const initialPick = r => r.person_id ?? r.matn_id ?? (r.status === 'new' ? NEW : null);

/** Export my whole network of connections («ثبتي»). */
function ThabatExport() {
  const { toast, notifyError } = useUI();
  const { data: mutoon } = useLoad(() => api.get('/mutoon?connected=1').then(r => r.data), [], []);
  const [which, setWhich] = useState('all');
  const [chosen, setChosen] = useState(() => new Set());
  const [quran, setQuran] = useState(true);
  const [bios, setBios] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const m = which === 'some' ? [...chosen].join(',') || 'none' : which;
    setBusy(true);
    try {
      await downloadFrom(`/share/thabat?mutoon=${m}&quran=${quran ? 1 : 0}&bios=${bios ? 1 : 0}`, 'isnad-thabat.json');
      toast('نُزّل ثبتك — يستورده غيرك من الإعدادات ← النسخ والنقل');
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const toggle = id => setChosen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <section className="card settings-section">
      <div className="card-head"><Icon name="books" /><div className="card-title">تصدير ثبتي</div><span className="muted">كل اتصالاتك — بلا إجازاتك ولا طلابك ولا إعداداتك</span></div>
      <div className="card-pad stack">
        <div className="row row-wrap" style={{ gap: 10 }}>
          <span className="small strong">المتون</span>
          <Segmented value={which} onChange={setWhich} options={[
            { value: 'all', label: 'كل المتون' }, { value: 'some', label: 'متون بعينها' }, { value: 'none', label: 'بلا متون' },
          ]} />
        </div>
        {which === 'some' && (
          <div className="chips">
            {mutoon.map(m => (
              <button key={m.id} type="button" className={`chip${chosen.has(m.id) ? ' active' : ''}`} onClick={() => toggle(m.id)}>{m.title}</button>
            ))}
          </div>
        )}
        {which !== 'all' && <div className="small muted">الاتصالات «العامة — لكل المتون» تُصدَّر مع أي متن تختاره.</div>}
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={quran} onChange={e => setQuran(e.target.checked)} /> أسانيد القرآن (مع القراءات والروايات والطرق)</label>
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={bios} onChange={e => setBios(e.target.checked)} /> التراجم (نبذ الأعلام)</label>
        <div>
          <button className="btn btn-primary btn-sm" onClick={run} disabled={busy || (which === 'none' && !quran)}>
            {busy ? <span className="spinner" /> : <><Icon name="arrow" size={14} /> تصدير الثبت</>}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Import another scholar's thabat: only the uncertain names and mutoon need a choice. */
function ThabatImport({ onImported }) {
  const { toast, notifyError } = useUI();
  const { data: lists } = useLoad(async () => {
    const [p, m] = await Promise.all([api.get('/persons'), api.get('/mutoon')]);
    return { persons: p.data.filter(x => x.id !== 0), mutoon: m.data };
  }, [], null);
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [prev, setPrev] = useState(null);
  const [pp, setPp] = useState({});     // persons picks
  const [mp, setMp] = useState({});     // mutoon picks
  const [showAll, setShowAll] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planErr, setPlanErr] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setPrev(null); setPp({}); setMp({}); setPlan(null); setPlanErr(''); setShowAll(false); };

  const open = async f => {
    const data = await readJsonFile(f);
    if (data?.format !== 'isnad-thabat') { toast('هذا الملف ليس ثبتاً مُصدَّراً من «إسناد»', 'error'); return; }
    setBusy(true);
    try {
      const { data: p } = await api.post('/share/thabat/preview', { file: data });
      setFile(data); setPrev(p);
      setPp(Object.fromEntries(p.persons.map(r => [r.ref, initialPick(r)])));
      setMp(Object.fromEntries(p.mutoon.map(r => [r.ref, initialPick(r)])));
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const leftP = prev ? prev.persons.filter(r => pp[r.ref] == null || pp[r.ref] === '') : [];
  const leftM = prev ? prev.mutoon.filter(r => mp[r.ref] == null || mp[r.ref] === '') : [];
  const byStatus = useMemo(() => {
    const c = {};
    (prev?.persons || []).forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [prev]);
  const rows = prev ? (showAll ? prev.persons : prev.persons.filter(r => r.status === 'ambiguous' || pp[r.ref] == null)) : [];
  const toCreate = prev ? prev.quranNames.filter(q => q.local_id == null) : [];

  useEffect(() => {
    setPlan(null); setPlanErr('');
    if (!prev || leftP.length || leftM.length) return;
    let alive = true;
    api.post('/share/thabat/import', { file, picks: { persons: pp, mutoon: mp }, dry_run: true })
      .then(r => alive && setPlan(r.data))
      .catch(e => alive && setPlanErr(errorMessage(e)));
    return () => { alive = false; };
  }, [prev, pp, mp]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/share/thabat/import', { file, picks: { persons: pp, mutoon: mp } }, { timeout: 0 });
      const r = data.result;
      toast(`تم: ${fmt(r.links)} اتصالاً، ${fmt(r.persons)} علَماً جديداً، ${fmt(r.mutoon)} متناً${r.fills ? `، وأُكملت بيانات ${fmt(r.fills)} علَماً` : ''}`);
      reset(); onImported?.();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const matnOptions = r => [
    { value: NEW, label: `➕ متن جديد: ${r.title}`, sub: r.author ? `للإمام ${r.author}` : undefined },
    ...(lists?.mutoon || []).map(m => ({ value: m.id, label: m.title, sub: m.author_name || undefined })),
  ];
  const c = plan?.counts;

  return (
    <section className="card settings-section">
      <div className="card-head"><Icon name="layers" /><div className="card-title">استيراد ثبت</div><span className="muted">ثبت مُصدَّر من نسخة أخرى — يُدمج في أسانيدك ولا يغيّر ما كتبتَه</span></div>
      <div className="card-pad stack">
        {!prev && (
          <div>
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy || !lists}>
              {busy ? <span className="spinner" /> : <><Icon name="plus" size={14} /> اختر ملف الثبت…</>}
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) open(f); }} />
          </div>
        )}

        {prev && (
          <>
            <div className="row row-wrap" style={{ gap: 8 }}>
              <span>ثبت <b>{prev.file.from}</b></span>
              <span className="badge">{fmt(prev.counts.persons)} علَماً · {fmt(prev.counts.mutoon)} متناً · {fmt(prev.counts.links + prev.counts.quran)} اتصالاً</span>
              {prev.file.exported_at && <span className="small muted">{new Date(prev.file.exported_at).toLocaleDateString('ar')}</span>}
              <div className="spacer" />
              <button className="btn btn-ghost btn-sm" onClick={reset}>إلغاء</button>
            </div>

            <div className="section-label">١. الأعلام</div>
            <div className="chips">
              {Object.entries(STATUS).filter(([k]) => byStatus[k]).map(([k, s]) => (
                <span key={k} className="badge"><span className="status-dot" style={{ background: s.color }} /> {s.label} {fmt(byStatus[k])}</span>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(v => !v)}>{showAll ? 'عرض ما يحتاج اختياراً فقط' : 'عرض الكل'}</button>
            </div>
            {!rows.length && <div className="small muted">لا شيء يحتاج اختياراً — طوبِق الجميع تلقائياً.</div>}
            <div>
              {rows.map(r => {
                const st = STATUS[r.status];
                return (
                  <div key={r.ref} className="parsed-link">
                    {r.role === 'sender' && <span className="badge badge-primary">المُرسِل</span>}
                    <span className="strong">{r.name_ar}</span>
                    {r.death_year && <span className="small muted">(ت {r.death_year})</span>}
                    <span className="status-dot" style={{ background: st.color }} />
                    <span className="tiny" style={{ color: st.color }}>{st.label}</span>
                    <div className="spacer" style={{ minWidth: 220 }}>
                      <Combobox value={pp[r.ref] ?? ''} onChange={v => setPp(p => ({ ...p, [r.ref]: v ?? null }))}
                        opts={pickOptions({ name: r.name_ar, death_year: r.death_year, candidates: r.candidates }, lists?.persons || [])}
                        placeholder="اختر العلَم…" invalid={pp[r.ref] == null} />
                    </div>
                  </div>
                );
              })}
            </div>

            {prev.mutoon.length > 0 && (
              <>
                <div className="section-label">٢. المتون</div>
                {prev.mutoon.map(r => (
                  <div key={r.ref} className="parsed-link">
                    <span className="strong">{r.title}</span>
                    {r.author && <span className="small muted">للإمام {r.author}</span>}
                    <span className="status-dot" style={{ background: STATUS[r.status].color }} />
                    <span className="tiny" style={{ color: STATUS[r.status].color }}>{STATUS[r.status].label}</span>
                    <div className="spacer" style={{ minWidth: 220 }}>
                      <Combobox value={mp[r.ref] ?? ''} onChange={v => setMp(p => ({ ...p, [r.ref]: v ?? null }))} opts={matnOptions(r)}
                        placeholder="اختر المتن…" invalid={mp[r.ref] == null} />
                    </div>
                  </div>
                ))}
              </>
            )}

            {toCreate.length > 0 && (
              <div className="small">
                تُضاف إلى بياناتك المرجعية لأنها غير موجودة عندك:{' '}
                {toCreate.map(q => <span key={q.ref} className="badge badge-accent" style={{ marginInlineEnd: 4 }}>{QURAN_KIND[q.kind]}: {q.name_ar}</span>)}
              </div>
            )}

            <div className="section-label">٣. ما سيُحفظ</div>
            {(leftP.length > 0 || leftM.length > 0) && <div className="small muted">بقي {fmt(leftP.length + leftM.length)} بانتظار الاختيار.</div>}
            {planErr && <div className="alert alert-error">{planErr}</div>}
            {c && (
              <>
                <div className="chips">
                  <span className="badge badge-primary">{fmt(c.links)} اتصالاً جديداً</span>
                  {c.existing > 0 && <span className="badge">{fmt(c.existing)} موجود لن يُكرَّر</span>}
                  {c.persons > 0 && <span className="badge">{fmt(c.persons)} علَماً جديداً</span>}
                  {c.mutoon > 0 && <span className="badge">{fmt(c.mutoon)} متناً جديداً</span>}
                  {c.quranNames > 0 && <span className="badge">{fmt(c.quranNames)} قراءة/رواية/طريق</span>}
                  {c.fills > 0 && <span className="badge">إكمال بيانات {fmt(c.fills)} علَماً</span>}
                </div>
                {plan.fills.length > 0 && (
                  <details>
                    <summary className="small">ما سيُكمَل (الحقول الفارغة عندك فقط)</summary>
                    {plan.fills.map(f => <div key={f.id} className="small">{f.name_ar}: {Object.keys(f.fields).map(k => ({ description: 'الترجمة', death_year: 'الوفاة', kunya: 'الكنية', nisba: 'النسبة', region: 'البلد', name_latin: 'الاسم اللاتيني', century: 'القرن' }[k])).join('، ')}</div>)}
                  </details>
                )}
                <div>
                  <button className="btn btn-primary" onClick={save} disabled={busy || (!c.links && !c.persons && !c.fills)}>
                    {busy ? <span className="spinner" /> : <><Icon name="save" size={16} /> استيراد الثبت</>}
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

export default function Thabat({ onImported }) {
  return (<><ThabatExport /><ThabatImport onImported={onImported} /></>);
}
