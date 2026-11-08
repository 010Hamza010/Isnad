import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import useDebounced from '../../hooks/useDebounced';
import { useUI } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Combobox from '../../components/ui/Combobox';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import Certificate from '../../components/ijaza/Certificate';
import { fillTemplate, readingPhrase, takhammulPhrase, formatDates, todayISO, ijazaTitle, PLACEHOLDERS, readingTeachers, teachersParagraph } from '../../utils/ijaza';
import { quranOptions, quranPathParams, groupsToChains } from '../../utils/quranOptions';
import { rowOptions, kindOfType } from '../../utils/options';

const STYLES = [
  { value: 'normal', label: 'عادية' },
  { value: 'detailed', label: 'مفصّلة' },
];

// keep only what the certificate needs (tree + notes) in the saved snapshot
const slimChain = c => c.map(e => ({
  from_person_id: e.from_person_id, from_name: e.from_name, from_death_year: e.from_death_year || null,
  to_person_id: e.to_person_id, to_name: e.to_name, to_death_year: e.to_death_year || null, tx_name: e.tx_name || null, tx_kind: e.tx_kind || null,
}));

const MODULES = [
  { value: 'mutoon', label: 'متن' },
  { value: 'quran', label: 'القرآن' },
  { value: 'general', label: 'إجازة عامة' },
];

/**
 * correction: an issued ijaza being corrected — the form starts from its data, and saving issues a
 * new ijaza that replaces it (the old one is revoked and linked, never edited).
 */
export default function NewIjaza({ settings, onSaved, onEditTemplates, correction = null, onCancelCorrection }) {
  const c0 = correction;
  const { toast, notifyError } = useUI();
  const { data: refs } = useLoad(async () => {
    const [m, c, q, r, t, tx, mc, is] = await Promise.all([
      api.get('/mutoon?connected=1'), api.get('/quran-connections'),
      api.get('/quran/qiraat'), api.get('/quran/riwayat'), api.get('/quran/turuq'), api.get('/tx-types'),
      api.get('/matn-connections'), api.get('/isnad-text/settings'),
    ]);
    return { mutoon: m.data, conns: c.data, qiraat: q.data, riwayat: r.data, turuq: t.data, txTypes: tx.data, matnConns: mc.data, isnadStyle: is.data.settings.style };
  }, [], { mutoon: [], conns: [], qiraat: [], riwayat: [], turuq: [], txTypes: [], matnConns: [], isnadStyle: {} });

  const [module, setModule]   = useState(c0?.module || 'mutoon');
  const [style, setStyle]     = useState(c0?.style || 'normal');
  const [clearWords, setClearWords] = useState(true);
  const [deathYears, setDeathYears] = useState(true);
  const [notes, setNotes]     = useState({});
  const [designId, setDesignId] = useState(c0?.details?.design?.id || settings.default_design);
  const design = settings.designs.find(x => x.id === designId) || settings.designs[0];
  const [student, setStudent] = useState(c0?.student_name || '');
  const [studentGender, setStudentGender] = useState('M');
  const [matnId, setMatnId]   = useState(c0?.matn_id || '');
  const [quranKey, setQuranKey] = useState(c0?.module === 'quran' ? `q${c0.qiraa_id || null}-r${c0.riwaya_id || null}-t${c0.tariq_id || null}` : '');
  const [txId, setTxId]       = useState(c0?.transmission_type_id ?? null);
  const [correctionReason, setCorrectionReason] = useState('');
  // default «كيف أخذ عنك»: this database's قراءة type (ids differ between databases)
  useEffect(() => {
    if (txId == null && refs.txTypes.length) setTxId((refs.txTypes.find(t => t.kind === 'qiraa') || refs.txTypes[0]).id);
  }, [refs.txTypes]);
  const [date, setDate]       = useState(todayISO());
  const [hijri, setHijri]     = useState(formatDates(todayISO()).hijri);
  const [place, setPlace]     = useState(c0?.place ?? settings.place);
  const [groups, setGroups]   = useState([]);
  const [chosen, setChosen]   = useState(new Set());
  const [pathsLoading, setPathsLoading] = useState(false);
  const [isnadText, setIsnadText] = useState('');
  const [manualBody, setManualBody] = useState(null);
  const [saving, setSaving]   = useState(false);

  const qOpts = useMemo(() => quranOptions(refs.conns, refs), [refs]);
  const quranOpt = qOpts.flatMap(([, o]) => o).find(o => o.key === quranKey);
  const matn = refs.mutoon.find(m => String(m.id) === String(matnId));

  // shuyukh I read this matn / riwaya on — listed before the isnad when there are two or more
  const teachers = useMemo(() => readingTeachers(module === 'mutoon' ? refs.matnConns : refs.conns, module, {
    matnId, option: quranOpt, riwayaQiraa: id => refs.riwayat.find(r => String(r.id) === String(id))?.qiraa_id,
  }), [module, matnId, quranOpt?.key, refs]);
  const teachersText = teachersParagraph(teachers, settings.teachers_sentence?.[module],
    { heart: refs.isnadStyle.heartWord, looking: refs.isnadStyle.lookingWord },
    { M: settings.teachers_title ?? 'الشيخ', F: settings.teachers_title_f ?? 'الشيخة' });

  const listsTeachers = teachersText !== '';


  // Hijri follows the Gregorian date; it stays editable (moon sighting may differ by a day)
  const changeDate = v => { setDate(v); setHijri(formatDates(v).hijri); };

  // load the isnad paths for the chosen matn / riwaya
  useEffect(() => {
    setGroups([]); setChosen(new Set()); setIsnadText('');
    const url = module === 'mutoon' && matnId ? `/graph/matn/${matnId}/paths`
              : module === 'quran' && quranOpt ? `/graph/quran/paths?${quranPathParams(quranOpt)}` : null;
    if (!url) return;
    let alive = true;
    setPathsLoading(true);
    api.get(url)
      .then(r => { if (!alive) return; setGroups(r.data.paths); setChosen(new Set(r.data.paths.map((_, i) => i))); })
      .catch(e => alive && notifyError(e))
      .finally(() => alive && setPathsLoading(false));
    return () => { alive = false; };
  }, [module, matnId, quranKey]);

  // render the chosen chains to prose with the user's keyword settings + this ijaza's style
  const chosenKey = useDebounced([...chosen].sort().join(','), 200);
  const chains = useMemo(() => groupsToChains(groups.filter((_, i) => chosen.has(i))), [groups, chosenKey]);
  useEffect(() => {
    if (!chains.length) { setIsnadText(''); setNotes({}); return; }
    let alive = true;
    // «غيباً من حفظي» is stated once: in the teachers paragraph when there is one, else in the isnad
    const renderStyle = { clear: clearWords, deathYears, noteMarkers: style === 'detailed', hideMyReadingMode: listsTeachers };
    api.post('/isnad-text/render', { chains, style: renderStyle })
      .then(r => {
        if (!alive) return;
        setIsnadText(r.data.text);
        setNotes(Object.fromEntries(r.data.persons.filter(p => p.description).map(p => [p.id, p])));
      })
      .catch(e => alive && notifyError(e));
    return () => { alive = false; };
  }, [chains, style, clearWords, deathYears, listsTeachers]);

  const reading = quranOpt ? readingPhrase({
    qiraa: quranOpt.qiraa_id ? quranOpt.qiraaLabel : null, riwaya: quranOpt.riwayaLabel, tariq: quranOpt.tariqLabel,
  }) : '';
  const dates = formatDates(date);

  const values = {
    'الطالب': student.trim(),
    'كيفية_الأخذ': takhammulPhrase(kindOfType(refs.txTypes, txId), studentGender),
    'المتن': matn?.title, 'المؤلف': matn?.author_name,
    // an unrestricted (مطلق) Quran connection has no riwaya to name
    'ما_قرئ': reading || (quranOpt ? 'بما قرأ به عليّ' : ''), 'القراءة': quranOpt?.qiraa_id ? quranOpt.qiraaLabel : '',
    'الرواية': quranOpt?.riwayaLabel, 'الطريق': quranOpt?.tariqLabel,
    'الإسناد': isnadText, 'المجيز': settings.shaykh_name, 'المكان': place,
    'شيوخ_القراءة': teachersText,
    'التاريخ': dates.gregorian, 'التاريخ_الهجري': hijri,
  };
  const filled = fillTemplate(settings.templates[module], values, {
    optional: ['شيوخ_القراءة'],
    genders: { 'المجاز': studentGender, 'المجيز': settings.shaykh_gender || 'M' },
  });
  const body = manualBody ?? filled.text;
  const title = ijazaTitle(module, { matn: matn?.title, reading });
  const missing = manualBody == null ? filled.missing : [];
  const hint = key => PLACEHOLDERS.find(p => p.key === key)?.hint || key;

  const reset = () => { setStudent(''); setManualBody(null); };

  const save = async () => {
    if (!student.trim()) return toast('اكتب اسم المجاز', 'error');
    if (module === 'mutoon' && !matnId) return toast('اختر المتن', 'error');
    setSaving(true);
    try {
      const { data: saved } = await api.post('/ijazat', {
        student_name: student, module, title, body,
        matn_id: module === 'mutoon' ? matnId : null,
        qiraa_id: module === 'quran' ? quranOpt?.qiraa_id : null,
        riwaya_id: module === 'quran' ? quranOpt?.riwaya_id : null,
        tariq_id: module === 'quran' ? quranOpt?.tariq_id : null,
        transmission_type_id: module === 'general' ? null : txId,
        issued_at: date, issued_hijri: hijri, place,
        style: detailed ? 'detailed' : 'normal',
        ...(correction ? { replaces_id: correction.id, correction_reason: correctionReason } : {}),
        // snapshot: reprints look the same even if the design or biographies change later
        details: { notes: detailed ? notes : {}, chains: chains.map(slimChain), design, people },
      });
      toast('حُفظت الإجازة — يمكنك طباعتها الآن مع رمز التحقق');
      reset(); onSaved(saved);
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const detailed = style === 'detailed' && module !== 'general';
  const people = { student: student.trim(), shaykh: settings.shaykh_name, names: teachers.map(t => t.name) };
  const txOpts = rowOptions(refs.txTypes.filter(t => t.applies_to === 'both' || t.applies_to === module));

  return (
    <>
    {correction && (
      <div className="alert alert-error row row-wrap" style={{ marginBottom: 14 }}>
        <span className="spacer">
          <strong>تصحيح الإجازة {correction.short_code}</strong> — ستصدر إجازة جديدة برمز جديد، وتُلغى القديمة مع الإشارة إلى الجديدة.
          لا يُعدَّل شيء في الإجازة القديمة.
        </span>
        <input className="input" style={{ maxWidth: 320 }} value={correctionReason} maxLength={150}
          onChange={e => setCorrectionReason(e.target.value)} placeholder="سبب التصحيح (يظهر في صفحة التحقق)" />
        <button className="btn btn-secondary btn-sm" onClick={onCancelCorrection}>إلغاء التصحيح</button>
      </div>
    )}
    <div className="ijaza-layout">
      <div className="card card-pad">
        <div className="field">
          <span className="field-label">نوع الإجازة</span>
          <Segmented value={module} onChange={v => { setModule(v); setManualBody(null); }} options={MODULES} />
        </div>
        {module !== 'general' && (
          <div className="field">
            <span className="field-label">الشكل</span>
            <Segmented value={style} onChange={v => { setStyle(v); setManualBody(null); }} options={STYLES} />
            <span className="field-hint">
              {style === 'detailed' ? 'ترجمة كل علَم في الهامش + صفحة لشجرة الإسناد' : 'نص الإجازة والإسناد فقط'}
            </span>
          </div>
        )}
        <Field label="اسم المجاز" required>
          <input className="input" value={student} onChange={e => setStudent(e.target.value)}
            placeholder={studentGender === 'F' ? 'الأخت الفاضلة فلانة بنت فلان' : 'الأخ الفاضل فلان بن فلان'} />
        </Field>
        <div className="field">
          <Segmented value={studentGender} onChange={v => { setStudentGender(v); setManualBody(null); }} options={[{ value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' }]} />
        </div>

        {module === 'mutoon' && (
          <Field label="المتن" required hint={!refs.mutoon.length ? 'لا توجد متون متصلة الإسناد بعد' : undefined}>
            <Combobox value={matnId} onChange={v => { setMatnId(v); setManualBody(null); }}
              opts={refs.mutoon.map(m => ({ value: m.id, label: m.title, sub: m.author_name }))} placeholder="ابحث عن متن…" />
          </Field>
        )}
        {module === 'quran' && (
          <Field label="القراءة / الرواية" hint={!qOpts.length ? 'سجّل قراءتك على شيوخك أولاً' : undefined}>
            <select className="select" value={quranKey} onChange={e => { setQuranKey(e.target.value); setManualBody(null); }}>
              <option value="">— اختر —</option>
              {qOpts.map(([label, opts]) => (
                <optgroup key={label} label={label}>
                  {opts.map(o => <option key={o.key} value={o.key}>{[o.riwayaLabel || (o.qiraa_id ? 'كل الروايات' : 'مطلق'), o.tariqLabel].filter(Boolean).join(' — ')}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
        )}
        {module !== 'general' && (
          <Field label="كيف أخذ عنك">
            <select className="select" value={txId ?? ''} onChange={e => setTxId(Number(e.target.value))}>
              {txOpts.map(o => <option key={o.value} value={o.value}>{o.label} — «{takhammulPhrase(kindOfType(refs.txTypes, o.value), studentGender)}»</option>)}
            </select>
          </Field>
        )}

        {module !== 'general' && (groups.length > 0 || pathsLoading) && (
          <div className="field">
            <span className="field-label">الأسانيد المضمّنة</span>
            {pathsLoading ? <div className="skeleton" style={{ height: 40 }} /> : (
              <div className="check-list">
                {groups.map((g, i) => (
                  <label key={i} className="check">
                    <input type="checkbox" checked={chosen.has(i)} onChange={e => setChosen(s => {
                      const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n;
                    })} />
                    <span>من طريق <strong>{g.firstEdge.to_name}</strong>{g.chains.length > 1 && <span className="muted small"> · {g.chains.length} طرق</span>}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {teachers.length > 1 && (
          <div className="callout" style={{ marginBottom: 14 }}>
            سيُذكر قبل الإسناد أنك قرأت على {teachers.length} من الشيوخ: {teachers.map(t => t.name).join('، ')}.
          </div>
        )}
        {module === 'mutoon' && matnId && !pathsLoading && !groups.length && (
          <div className="munqati" style={{ marginBottom: 14 }}><Icon name="alert" size={16} /> لا يوجد سند متصل لهذا المتن</div>
        )}

        {module !== 'general' && (
          <div className="field">
            <label className="check">
              <input type="checkbox" checked={clearWords} onChange={e => { setClearWords(e.target.checked); setManualBody(null); }} />
              عبارات صريحة (قرأتُ على فلان، وهو سمع من فلان…)
            </label>
            <label className="check">
              <input type="checkbox" checked={deathYears} onChange={e => { setDeathYears(e.target.checked); setManualBody(null); }} />
              تاريخ الوفاة بعد كل اسم (ت …هـ)
            </label>
          </div>
        )}

        <Field label="التصميم" hint="عدّل التصاميم أو أنشئ تصميمك من تبويب «التصميم»">
          <select className="select" value={design.id} onChange={e => setDesignId(e.target.value)}>
            {settings.designs.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>

        <div className="form-grid">
          <Field label="التاريخ"><input className="input" type="date" value={date} onChange={e => changeDate(e.target.value)} /></Field>
          <Field label="الهجري"><input className="input" value={hijri} onChange={e => setHijri(e.target.value)} /></Field>
        </div>
        <Field label="المكان"><input className="input" value={place} onChange={e => setPlace(e.target.value)} placeholder="فاس" /></Field>
      </div>

      <div className="stack">
        {missing.length > 0 && (
          <div className="alert alert-error">
            حقول ناقصة في النص: {missing.map(hint).join('، ')}.
            {missing.includes('المجيز') && <> <button className="strong" style={{ color: 'inherit', textDecoration: 'underline' }} onClick={onEditTemplates}>أضف اسمك في القوالب</button></>}
          </div>
        )}
        {manualBody != null && (
          <div className="alert alert-success row">
            <span className="spacer">عدّلت النص يدوياً — تغييرات النموذج لن تُطبّق عليه.</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setManualBody(null)}><Icon name="reset" size={14} /> إعادة التوليد</button>
          </div>
        )}

        <div className="row row-wrap">
          <button className={`btn btn-sm ${manualBody != null ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setManualBody(manualBody ?? filled.text)}>
            <Icon name="edit" size={14} /> تعديل النص
          </button>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={save} disabled={saving}
            title="تُحفظ في السجل وتحصل على رمز التحقق، ثم تُفتح للطباعة">
            {saving ? <span className="spinner" /> : <Icon name="save" size={16} />} حفظ وإصدار
          </button>
        </div>

        {manualBody != null && (
          <>
            <textarea className="textarea cert-editor" value={manualBody} onChange={e => setManualBody(e.target.value)} />
            {detailed && <p className="small muted">العلامات مثل [[12]] تربط الاسم بحاشيته أسفل الصفحة — احذفها لإخفاء الحاشية.</p>}
          </>
        )}
        {detailed && chains.length > 0 && Object.keys(notes).length === 0 && (
          <div className="callout">لا توجد تراجم للأعلام في هذا الإسناد — أضفها في صفحة <Link to="/persons">الأعلام</Link> لتظهر في الهامش.</div>
        )}
        <Certificate title={title} body={body} variant={detailed ? 'detailed' : 'normal'}
          notes={notes} chains={chains} design={design} people={people} verification={{ placeholder: true }} />
        <p className="small muted">
          الصيغ في نص الإسناد تُضبط من <Link to="/settings">الإعدادات</Link>، ونص الإجازة من تبويب «القوالب». بعد «حفظ وإصدار» تُفتح الإجازة برمز التحقق للطباعة أو الحفظ كـ PDF.
        </p>
      </div>
    </div>
    </>
  );
}
