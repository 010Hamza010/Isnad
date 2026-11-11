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
import { fillTemplate, GROUP_MODES, takhammulPhrase, formatDates, todayISO, titleFromTemplate, withTitleStyle, PLACEHOLDERS, readingTeachers, readOnShaykh, withReads, isnadSections, multiIsnadTemplate, teachersParagraph, teacherOrderKey, sortByOrder, orderablePeople, moveId } from '../../utils/ijaza';
import TitleStyleFields from '../../components/ijaza/TitleStyleFields';
import { ijazaChoices, addChoice, choicesReading, groupsToChains } from '../../utils/quranOptions';
import { rowOptions, kindOfType } from '../../utils/options';


// keep only what the certificate needs (tree + notes) in the saved snapshot
const slimChain = c => c.filter(e => !e.group_stop).map(e => ({
  from_person_id: e.from_person_id, from_name: e.from_name, from_death_year: e.from_death_year || null,
  to_person_id: e.to_person_id, to_name: e.to_name, to_death_year: e.to_death_year || null, tx_name: e.tx_name || null, tx_kind: e.tx_kind || null,
}));

// the picked choices of an issued ijaza (for a correction); older ijazat had one choice
const keysOf = c => (c.details?.choices?.length ? c.details.choices.map(x => x.key)
  : c.details?.group?.id ? [`g${c.details.group.id}`]
  : c.riwaya_id ? [`r${c.riwaya_id}-t${c.tariq_id || 0}`] : c.qiraa_id ? [`q${c.qiraa_id}`] : []);

const MODULES = [
  { value: 'mutoon', label: 'متن' },
  { value: 'quran', label: 'القرآن' },
  { value: 'general', label: 'إجازة عامة' },
];

/**
 * correction: an issued ijaza being corrected — the form starts from its data, and saving issues a
 * new ijaza that replaces it (the old one is revoked and linked, never edited).
 */
export default function NewIjaza({ settings, options, profile = {}, onSaved, onEditTemplates, correction = null, onCancelCorrection }) {
  const c0 = correction;
  const { toast, notifyError } = useUI();
  const { data: refs } = useLoad(async () => {
    const [m, c, q, r, t, tx, mc, is, to, g] = await Promise.all([
      api.get('/mutoon?connected=1'), api.get('/quran-connections'),
      api.get('/quran/qiraat'), api.get('/quran/riwayat'), api.get('/quran/turuq'), api.get('/tx-types'),
      api.get('/matn-connections'), api.get('/isnad-text/settings'), api.get('/ijazat/teacher-orders'), api.get('/quran/groups'),
    ]);
    return { mutoon: m.data, conns: c.data, qiraat: q.data, riwayat: r.data, turuq: t.data, txTypes: tx.data, matnConns: mc.data, isnadStyle: is.data.settings.style, orders: to.data.orders || {}, groups: g.data };
  }, [], { mutoon: [], conns: [], qiraat: [], riwayat: [], turuq: [], txTypes: [], matnConns: [], isnadStyle: {}, orders: {}, groups: [] });

  const [module, setModule]   = useState(c0?.module || 'mutoon');
  // every ijaza is issued in two versions; this only picks which one the preview shows
  const [preview, setPreview] = useState('normal');
  const [fitInfo, setFitInfo] = useState(null);  // { fit, pages } of the normal version
  const [pages, setPages] = useState({ normal: 0, detailed: 0 }); // page count of each version's preview
  const [clearWords, setClearWords] = useState(true);
  const [deathYears, setDeathYears] = useState(true);
  const [notes, setNotes]     = useState({});
  const [designId, setDesignId] = useState(c0?.details?.design?.id || settings.default_design);
  const design = settings.designs.find(x => x.id === designId) || settings.designs[0];
  const [student, setStudent] = useState(c0?.student_name || '');
  const [studentGender, setStudentGender] = useState('M');
  const [matnId, setMatnId]   = useState(c0?.matn_id || '');
  // Quran: what the ijaza is given for — several groups, whole qiraat, riwayat (keys of ijazaChoices)
  const [picked, setPicked] = useState(c0?.module === 'quran' ? keysOf(c0) : []);
  // a group or whole qiraa: what follows the meeting point for this ijaza (null = the settings' default),
  // and the riwaya to continue with, per choice
  const [groupMode, setGroupMode] = useState(c0?.details?.group_mode ?? c0?.details?.group?.mode ?? null);
  const [riwayaFor, setRiwayaFor] = useState(c0?.details?.riwaya_for ?? {});
  const [infos, setInfos] = useState({});   // key → { mode, riwaya_id, riwayat } from the server
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
  const [isnadFull, setIsnadFull] = useState({ text: '', names: [] }); // detailed version: kunya + nisba
  const [authorNames, setAuthorNames] = useState([]);
  // hand edits of this ijaza, per version (null = generated from the template)
  const [manual, setManual] = useState({ normal: null, detailed: null });
  const resetText = () => setManual({ normal: null, detailed: null });
  const [titleText, setTitleText] = useState(c0?.title ?? null); // null = from the type's title template
  const [titleStyle, setTitleStyle] = useState(c0?.details?.titleStyle ?? null); // null = the template's
  const [scale, setScale] = useState({ normal: 1, detailed: 1, ...(c0?.details?.scale || {}) });
  const [customOpen, setCustomOpen] = useState(false);
  const [saving, setSaving]   = useState(false);

  const choices = useMemo(() => ijazaChoices(refs.conns, refs), [refs]);
  const pickedChoices = picked.map(k => choices.find(c => c.key === k)).filter(Boolean);
  const pickedKey = pickedChoices.map(c => c.key).join('+');
  const single = pickedChoices.length === 1 ? pickedChoices[0] : null;
  const matn = refs.mutoon.find(m => String(m.id) === String(matnId));
  // where the isnad comes from: the matn, or each Quran choice (one paragraph each)
  const sources = module === 'mutoon' && matnId ? [{ key: 'm', url: `/graph/matn/${matnId}/paths`, label: '' }]
    : module === 'quran' ? pickedChoices : [];
  const riwayaQiraa = id => refs.riwayat.find(r => String(r.id) === String(id))?.qiraa_id;

  // my teachers' order for this matn / riwaya (saved, reused by later ijazat): the teachers paragraph
  // and the routes of the isnad follow it
  const [orders, setOrders] = useState({});
  useEffect(() => { setOrders(refs.orders || {}); }, [refs.orders]);
  const orderKey = teacherOrderKey(module, { matnId, quranKey: pickedKey });
  const orderIds = (orderKey && orders[orderKey]) || [];
  // teachers I left out of the teachers paragraph (also saved per matn / riwaya)
  const hiddenIds = (orderKey && orders[`${orderKey}.hidden`]) || [];
  const isHidden = id => hiddenIds.some(h => String(h) === String(id));

  // shuyukh I read this matn / riwaya on — listed before the isnad when there are two or more
  const teachersRaw = useMemo(() => {
    if (module === 'mutoon') return readingTeachers(refs.matnConns, module, { matnId });
    if (module !== 'quran') return [];
    // every choice's shuyukh, once each, with what I read on him for each choice
    // (a group holding the choice first, else only what concerns it)
    const merged = new Map();
    pickedChoices.forEach(c => readingTeachers(refs.conns, module, {
      option: c.readOption, groups: refs.groups, riwayaQiraa, readOf: links => readOnShaykh(links, c.readOption, refs),
    }).forEach(t => {
      const prev = merged.get(t.id);
      merged.set(t.id, !prev ? t : { ...prev, reading_mode: prev.reading_mode || t.reading_mode,
        read: [...new Set([prev.read, t.read].filter(Boolean))].join(' و') || null });
    }));
    return [...merged.values()];
  }, [module, matnId, pickedKey, refs]); // eslint-disable-line react-hooks/exhaustive-deps
  const teachers = useMemo(() => sortByOrder(teachersRaw, orderIds).filter(t => !isHidden(t.id)),
    [teachersRaw, orderIds.join(','), hiddenIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const teachersText = teachersParagraph(teachers, settings.teachers_sentence?.[module],
    { heart: refs.isnadStyle.heartWord, looking: refs.isnadStyle.lookingWord },
    { M: settings.teachers_title ?? 'الشيخ', F: settings.teachers_title_f ?? 'الشيخة' });

  const listsTeachers = teachersText !== '';


  // Hijri follows the Gregorian date; it stays editable (moon sighting may differ by a day)
  const changeDate = v => { setDate(v); setHijri(formatDates(v).hijri); };

  // load the isnad paths of every source; each route keeps its source (pick)
  const riwayaForKey = JSON.stringify(riwayaFor);
  useEffect(() => {
    setGroups([]); setChosen(new Set()); setIsnadText(''); setInfos({});
    if (!sources.length) return;
    let alive = true;
    setPathsLoading(true);
    const urlOf = src => {
      if (!src.url.includes('group-paths')) return src.url;
      const p = new URLSearchParams();
      if (groupMode) p.append('mode', groupMode);
      if (riwayaFor[src.key]) p.append('riwaya_id', riwayaFor[src.key]);
      return p.toString() ? `${src.url}&${p}` : src.url;
    };
    Promise.all(sources.map(src => api.get(urlOf(src)).then(r => ({ key: src.key, data: r.data }))))
      .then(res => {
        if (!alive) return;
        const all = res.flatMap(x => x.data.paths.map(g => ({ ...g, pick: x.key })));
        setGroups(all); setChosen(new Set(all.map((_, i) => i)));
        setInfos(Object.fromEntries(res.filter(x => x.data.group).map(x => [x.key, { mode: x.data.mode, riwaya_id: x.data.riwaya_id, riwayat: x.data.riwayat }])));
      })
      .catch(e => alive && notifyError(e))
      .finally(() => alive && setPathsLoading(false));
    return () => { alive = false; };
  }, [module, matnId, pickedKey, groupMode, riwayaForKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // render the chosen chains to prose with the user's keyword settings + this ijaza's style
  const shuyukh = useMemo(() => orderablePeople(groups, teachersRaw, orderIds), [groups, teachersRaw, orderIds.join(',')]);
  const routeOrder = shuyukh.flatMap(p => p.routes);               // group indices in my order
  const chosenKey = useDebounced(`${[...chosen].sort().join(',')}|${routeOrder.join(',')}`, 200);
  // one section per source; Quran: every link says what was read on it, «قرأ بقراءة عاصم على فلان، وهو قرأ بها على …»
  const sections = useMemo(() => sources.map(src => {
    const list = groupsToChains(routeOrder.filter(i => chosen.has(i) && groups[i].pick === src.key).map(i => groups[i]));
    return { key: src.key, label: src.label, chains: module === 'quran' ? withReads(list, src.readOption, refs) : list };
  }), [groups, chosenKey, module, pickedKey, refs]); // eslint-disable-line react-hooks/exhaustive-deps
  const chains = useMemo(() => sections.flatMap(x => x.chains), [sections]);
  // the tree shows people only: not the stop of a group's isnad
  const treeChains = useMemo(() => chains.map(c => c.filter(e => !e.group_stop)), [chains]);

  const saveOrder = (key, ids) => {
    setOrders(o => ({ ...o, [key]: ids }));
    resetText();
    api.put(`/ijazat/teacher-orders/${encodeURIComponent(key)}`, { ids }).catch(notifyError);
  };
  const moveTeacher = (i, dir) => { if (orderKey) saveOrder(orderKey, moveId(shuyukh, i, dir)); };
  const toggleInParagraph = (id, on) => {
    if (!orderKey) return;
    const rest = hiddenIds.filter(h => String(h) !== String(id));
    saveOrder(`${orderKey}.hidden`, on ? rest : [...rest, Number(id)]);
  };
  useEffect(() => {
    if (!chains.length) { setIsnadText(''); setIsnadFull({ text: '', names: [] }); setAuthorNames([]); setNotes({}); return; }
    let alive = true;
    // «غيباً من حفظي» is stated once: in the teachers paragraph when there is one, else in the isnad
    // markers [[id]] are invisible in the normal version and become footnotes in the detailed one
    const renderStyle = { clear: clearWords, deathYears, noteMarkers: true, hideMyReadingMode: listsTeachers };
    // the matn's author is written «المؤلف فلان» in his own colour
    const authorId = module === 'mutoon' ? matn?.author_id ?? null : null;
    // each section is rendered on its own: several Quran choices → «وإسنادي في رواية قالون: …» paragraphs
    const parts = sections.filter(x => x.chains.length);
    Promise.all(parts.map(x => Promise.all([
      api.post('/isnad-text/render', { chains: x.chains, style: renderStyle, authorId }),
      api.post('/isnad-text/render', { chains: x.chains, style: { ...renderStyle, fullNames: true }, authorId }),
    ])))
      .then(res => {
        if (!alive) return;
        // every source in its place (one without a route is left out of the paragraphs); v: 0 normal, 1 full names
        const textOf = v => isnadSections(sections.map(x => ({ label: x.label, text: parts.includes(x) ? res[parts.indexOf(x)][v].data.text : '' })));
        setIsnadText(textOf(0));
        setIsnadFull({ text: textOf(1),
          names: [...new Set(res.flatMap(([, full]) => full.data.names || []))] });
        setAuthorNames([...new Set(res.flatMap(([r, full]) => [...(r.data.authorNames || []), ...(full.data.authorNames || [])]))]);
        setNotes(Object.fromEntries(res.flatMap(([r]) => r.data.persons).filter(p => p.description).map(p => [p.id, p])));
      })
      .catch(e => alive && notifyError(e));
    return () => { alive = false; };
  }, [sections, clearWords, deathYears, listsTeachers, matn?.author_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // «برواية قالون عن نافع ورواية حفص عن عاصم» (title); in the text a group's books «… بمضمن الشاطبية والدرة»
  const reading = module === 'quran' ? choicesReading(pickedChoices) : '';
  const readWith = module === 'quran' ? choicesReading(pickedChoices, { withBooks: true }) : '';
  const one = single?.kind === 'riwaya' ? single.readOption : null;   // one riwaya: its own placeholders
  // the Quran is always «قرأ» for now
  const qiraaTx = refs.txTypes.find(t => t.kind === 'qiraa')?.id ?? txId;
  const effTx = module === 'quran' ? qiraaTx : txId;
  const dates = formatDates(date);

  const values = {
    'الطالب': student.trim(),
    'كيفية_الأخذ': takhammulPhrase(kindOfType(refs.txTypes, effTx), studentGender),
    'المتن': matn?.title, 'المؤلف': matn?.author_name,
    // an unrestricted (مطلق) Quran connection has no riwaya to name
    'ما_قرئ': readWith, 'القراءة': one?.qiraa_id ? one.qiraaLabel : single?.kind === 'whole' ? single.label : '',
    'الرواية': one?.riwayaLabel, 'الطريق': one?.tariqLabel,
    'الإسناد': isnadText, 'المجيز': settings.shaykh_name, 'المكان': place,
    'شيوخ_القراءة': teachersText,
    'التاريخ': dates.gregorian, 'التاريخ_الهجري': hijri,
  };
  const fillOpts = {
    optional: ['شيوخ_القراءة'],
    genders: { 'المجاز': studentGender, 'المجيز': settings.shaykh_gender || 'M' },
  };
  // several choices: the paragraphs say «وإسنادي في …» themselves
  const template = module === 'quran' && sources.length > 1 ? multiIsnadTemplate(settings.templates[module]) : settings.templates[module];
  const filled = fillTemplate(template, values, fillOpts);
  const body = manual.normal ?? filled.text;
  // the detailed version names everyone in full (kunya + nisba); each version can be edited by hand
  const generatedDetailed = fillTemplate(template, { ...values, 'الإسناد': isnadFull.text || isnadText }, fillOpts).text;
  const bodyDetailed = manual.detailed ?? generatedDetailed;
  const generatedTitle = titleFromTemplate(settings.titles?.[module], module, { ...values, 'القراءة_والرواية': reading });
  const title = titleText ?? generatedTitle;
  const effTitleStyle = titleStyle ?? settings.titles?.[module] ?? {};
  const designFinal = useMemo(() => withTitleStyle(design, effTitleStyle), [design, effTitleStyle.color, effTitleStyle.family, effTitleStyle.size]);
  const missing = manual.normal == null ? filled.missing : [];
  const hint = key => PLACEHOLDERS.find(p => p.key === key)?.hint || key;

  const reset = () => { setStudent(''); resetText(); setTitleText(null); };

  const save = async () => {
    if (!student.trim()) return toast('اكتب اسم المجاز', 'error');
    if (module === 'mutoon' && !matnId) return toast('اختر المتن', 'error');
    if (module === 'quran' && !pickedChoices.length) return toast('اختر ما قرأ', 'error');
    setSaving(true);
    try {
      const { data: saved } = await api.post('/ijazat', {
        student_name: student, module, title, body,
        matn_id: module === 'mutoon' ? matnId : null,
        // one riwaya or whole qiraa: also in the columns (search, older views); several: in details.choices
        qiraa_id: module === 'quran' ? (one?.qiraa_id || (single?.kind === 'whole' ? single.qiraa_id : null)) : null,
        riwaya_id: module === 'quran' ? one?.riwaya_id || null : null,
        tariq_id: module === 'quran' ? one?.tariq_id || null : null,
        transmission_type_id: module === 'general' ? null : effTx,
        issued_at: date, issued_hijri: hijri, place,
        style: 'normal',
        ...(correction ? { replaces_id: correction.id, correction_reason: correctionReason } : {}),
        // snapshot: reprints look the same even if the design or biographies change later
        // dual: issued as a normal (printed, one page) and a detailed (footnotes + tree) version
        details: {
          notes, chains: chains.map(slimChain), design: designFinal, people, dual: module !== 'general',
          ...(module === 'quran' ? {
            choices: pickedChoices.map(c => ({ key: c.key, kind: c.kind, label: c.label })),
            ...(Object.keys(infos).length ? { group_mode: Object.values(infos)[0].mode,
              riwaya_for: Object.fromEntries(Object.entries(infos).filter(([, i]) => i.mode === 'riwaya').map(([k, i]) => [k, i.riwaya_id])) } : {}),
          } : {}),
          ...(module !== 'general' && bodyDetailed !== body ? { body_detailed: bodyDetailed } : {}),
          ...(titleStyle ? { titleStyle } : {}),
          scale,
        },
      });
      toast('حُفظت الإجازة — يمكنك طباعتها الآن مع رمز التحقق');
      reset(); onSaved(saved);
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const hasDetailed = module !== 'general';
  const detailed = hasDetailed && preview === 'detailed';
  const ver = detailed ? 'detailed' : 'normal';
  const verLabel = !hasDetailed ? '' : detailed ? 'المفصّلة' : 'العادية';
  const editing = manual[ver];
  // shaykh = full name (signature), me = short name (tree)
  const people = { student: student.trim(), shaykh: settings.shaykh_name, me: profile.short_name || settings.shaykh_name, names: [...teachers.map(t => t.name), ...isnadFull.names], author: authorNames };
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
          onChange={e => setCorrectionReason(e.target.value)} placeholder="سبب التصحيح (يظهر عند التحقق)" />
        <button className="btn btn-secondary btn-sm" onClick={onCancelCorrection}>إلغاء التصحيح</button>
      </div>
    )}
    <div className="ijaza-layout">
      <div className="card card-pad">
        <div className="field">
          <span className="field-label">نوع الإجازة</span>
          <Segmented value={module} onChange={v => { setModule(v); resetText(); }} options={MODULES} />
        </div>

        <Field label="التصميم" hint="عدّل التصاميم أو أنشئ تصميمك من تبويب «التصميم»">
          <select className="select" value={design.id} onChange={e => setDesignId(e.target.value)}>
            {settings.designs.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        
        <Field label="اسم المجاز" required>
          <input className="input" value={student} onChange={e => setStudent(e.target.value)}
            placeholder={studentGender === 'F' ? 'الأخت الفاضلة فلانة بنت فلان' : 'الأخ الفاضل فلان بن فلان'} />
        </Field>
        <div className="field">
          <Segmented value={studentGender} onChange={v => { setStudentGender(v); resetText(); }} options={[{ value: 'M', label: 'ذكر' }, { value: 'F', label: 'أنثى' }]} />
        </div>

        {module === 'mutoon' && (
          <Field label="المتن" required hint={!refs.mutoon.length ? 'لا توجد متون متصلة الإسناد بعد' : undefined}>
            <Combobox value={matnId} onChange={v => { setMatnId(v); resetText(); }}
              opts={refs.mutoon.map(m => ({ value: m.id, label: m.title, sub: m.author_name }))} placeholder="ابحث عن متن…" />
          </Field>
        )}
        {module === 'quran' && (
          <Field label="ما قرأ عليّ" hint={!choices.length ? 'سجّل قراءتك على شيوخك أولاً' : 'مجموعة، أو قراءة كاملة، أو رواية أو أكثر — لكلٍّ إسناده'}>
            <Combobox value="" allowClear={false} placeholder="أضف مجموعة أو قراءة أو رواية…"
              opts={choices.filter(c => !picked.includes(c.key)).map(c => ({ value: c.key, label: c.name, sub: c.kind === 'group' ? 'مجموعة' : c.kind === 'whole' ? 'قراءة كاملة' : undefined }))}
              onChange={k => { if (k) { setPicked(p => addChoice(p, k, choices)); resetText(); } }} />
            <div className="chips scope-chips">
              {pickedChoices.map(c => (
                <span key={c.key} className={`badge scope-chip ${c.kind === 'group' ? 'badge-purple' : 'badge-accent'}`}>
                  {c.name}
                  <button type="button" className="chip-x" aria-label={`إزالة ${c.name}`} title="إزالة"
                    onClick={() => { setPicked(p => p.filter(k => k !== c.key)); resetText(); }}><Icon name="x" size={12} /></button>
                </span>
              ))}
            </div>
          </Field>
        )}
        {module === 'quran' && pickedChoices.some(c => c.kind !== 'riwaya') && (
          <Field label="إسناد المجموعات والقراءات الكاملة" hint="التوقف عند ابن الجزري (أو الداني للعشر النافعية)، أو رواية واحدة، أو الكل. الافتراضي ونقاط التوقف من تبويب «القوالب».">
            <select className="select" value={groupMode ?? Object.values(infos)[0]?.mode ?? settings.quran_group?.mode ?? 'stop'}
              onChange={e => { setGroupMode(e.target.value); resetText(); }}>
              {GROUP_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {pickedChoices.filter(c => infos[c.key]?.mode === 'riwaya' && infos[c.key].riwayat?.length > 1).map(c => (
              <label key={c.key} className="row small" style={{ gap: 8, marginTop: 6 }}>
                <span style={{ minWidth: 120 }}>{c.name}:</span>
                <select className="select" value={infos[c.key].riwaya_id ?? ''}
                  onChange={e => { setRiwayaFor(f => ({ ...f, [c.key]: Number(e.target.value) })); resetText(); }}>
                  {infos[c.key].riwayat.map(r => <option key={r.id} value={r.id}>{r.name_ar}{r.qiraa_name ? ` — ${r.qiraa_name}` : ''}</option>)}
                </select>
              </label>
            ))}
          </Field>
        )}
        {module === 'mutoon' && (
          <Field label="كيف أخذ عنك">
            <select className="select" value={txId ?? ''} onChange={e => setTxId(Number(e.target.value))}>
              {txOpts.map(o => <option key={o.value} value={o.value}>{o.label} — «{takhammulPhrase(kindOfType(refs.txTypes, o.value), studentGender)}»</option>)}
            </select>
          </Field>
        )}

        {module !== 'general' && (shuyukh.length > 0 || pathsLoading) && (
          <div className="field">
            <span className="field-label">شيوخي في هذه الإجازة — رتّبهم</span>
            <span className="field-hint" style={{ marginTop: 0, marginBottom: 6 }}>
              يُحفظ الترتيب ومن في فقرة الشيوخ لهذا {module === 'quran' ? 'الطريق' : 'المتن'} ويُستعمل في الإجازات القادمة. فقرة الشيوخ تظهر إذا اخترتَ شيخين أو أكثر.
            </span>
            {pathsLoading ? <div className="skeleton" style={{ height: 40 }} /> : (
              <div className="order-list">
                {shuyukh.map((p, i) => (
                  <div key={p.id} className="order-row">
                    <div className="order-btns">
                      <button type="button" className="icon-btn" disabled={i === 0} onClick={() => moveTeacher(i, -1)} aria-label="أعلى" title="أعلى">▲</button>
                      <button type="button" className="icon-btn" disabled={i === shuyukh.length - 1} onClick={() => moveTeacher(i, 1)} aria-label="أسفل" title="أسفل">▼</button>
                    </div>
                    <div className="spacer">
                      <strong>{p.name}</strong>
                      {p.reads && <span className="badge" style={{ marginInlineStart: 6 }}>قرأتُ عليه</span>}
                      {p.reads && (
                        <>
                          <br />
                          <label className="check small" style={{ marginTop: 2 }}>
                            <input type="checkbox" checked={!isHidden(p.id)} onChange={e => toggleInParagraph(p.id, e.target.checked)} />
                            <span>في فقرة الشيوخ</span>
                          </label>
                        </>
                      )}
                      {p.routes.map(gi => (
                        <>
                          <br />
                          <label key={gi} className="check small" style={{ marginTop: 2 }}>
                            <input type="checkbox" checked={chosen.has(gi)} onChange={e => setChosen(s => {
                              const n = new Set(s); if (e.target.checked) n.add(gi); else n.delete(gi); return n;
                            })} />
                            <span>في الإسناد{pickedChoices.length > 1 && <> — {pickedChoices.find(c => c.key === groups[gi].pick)?.name}</>}{groups[gi].chains.length > 1 && <span className="muted"> · {groups[gi].chains.length} طرق</span>}</span>
                          </label>
                        </>
                      ))}
                      {!p.routes.length && <div className="tiny muted">لا سند متصل من طريقه</div>}
                    </div>
                  </div>
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
        {module === 'quran' && !pathsLoading && pickedChoices.filter(c => !groups.some(g => g.pick === c.key)).map(c => (
          <div key={c.key} className="munqati" style={{ marginBottom: 14 }}><Icon name="alert" size={16} /> لا يوجد سند لـ«{c.name}» من اتصالاتك</div>
        ))}
        {module === 'mutoon' && matnId && !pathsLoading && !groups.length && (
          <div className="munqati" style={{ marginBottom: 14 }}><Icon name="alert" size={16} /> لا يوجد سند متصل لهذا المتن</div>
        )}

        {module !== 'general' && (
          <div className="field">
            <label className="check">
              <input type="checkbox" checked={clearWords} onChange={e => { setClearWords(e.target.checked); resetText(); }} />
              عبارات صريحة (قرأتُ على فلان، وهو سمع من فلان…)
            </label>
            <label className="check">
              <input type="checkbox" checked={deathYears} onChange={e => { setDeathYears(e.target.checked); resetText(); }} />
              تاريخ الوفاة بعد كل اسم (ت …هـ)
            </label>
          </div>
        )}

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
        {editing != null && (
          <div className="alert alert-success row">
            <span className="spacer">عدّلت نص النسخة {verLabel} يدوياً — تغييرات النموذج لن تُطبّق عليه.</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setManual(m => ({ ...m, [ver]: null }))}><Icon name="reset" size={14} /> إعادة التوليد</button>
          </div>
        )}

        <div className="row row-wrap">
          <button className={`btn btn-sm ${editing != null ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setManual(m => ({ ...m, [ver]: m[ver] ?? (ver === 'detailed' ? generatedDetailed : filled.text) }))}
            title="يخص النسخة المعروضة فقط">
            <Icon name="edit" size={14} /> تعديل نص النسخة {verLabel}
          </button>
          <button className={`btn btn-sm ${customOpen ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setCustomOpen(o => !o)}>
            <Icon name="settings" size={14} /> العنوان والحجم
          </button>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={save} disabled={saving}
            title="تُحفظ في السجل وتحصل على رمز التحقق، ثم تُفتح للطباعة">
            {saving ? <span className="spinner" /> : <Icon name="save" size={16} />} حفظ وإصدار
          </button>
        </div>

        {customOpen && (
          <div className="card card-pad">
            <Field label="العنوان" hint={titleText != null ? undefined : 'من قالب العنوان — اكتب لتغييره لهذه الإجازة فقط، واضغط Enter لبدء سطر جديد'}>
              <div className="row">
                <textarea className="textarea" rows={Math.min(4, title.split('\n').length + 1)} style={{ minHeight: 0, textAlign: 'center' }}
                  value={title} onChange={e => setTitleText(e.target.value)} />
                {titleText != null && <button className="btn btn-ghost btn-sm" onClick={() => setTitleText(null)} title="من القالب"><Icon name="reset" size={14} /></button>}
              </div>
            </Field>
            <TitleStyleFields value={effTitleStyle} onChange={setTitleStyle} options={options} design={design} />
            <Field label={`حجم نص النسخة ${verLabel}: ${Math.round(scale[ver] * 100)}%`}
              hint={ver === 'normal' ? 'الحد الأعلى؛ يُصغَّر تلقائياً إن لم يتسع في صفحة واحدة' : 'صغّره قليلاً ليقلّ عدد الصفحات'}>
              <div className="row">
                <input type="range" min="0.7" max="1.15" step="0.01" value={scale[ver]} style={{ flex: 1 }}
                  onChange={e => setScale(sc => ({ ...sc, [ver]: Number(e.target.value) }))} />
                {scale[ver] !== 1 && <button className="btn btn-ghost btn-sm" onClick={() => setScale(sc => ({ ...sc, [ver]: 1 }))}>100%</button>}
              </div>
            </Field>
            {pages[ver] > 0 && <p className="small muted">عدد الصفحات الآن: {pages[ver]}</p>}
          </div>
        )}

        {editing != null && (
          <>
            <textarea className="textarea cert-editor" value={editing} onChange={e => setManual(m => ({ ...m, [ver]: e.target.value }))} />
            {hasDetailed && <p className="small muted">العلامات مثل [[12]] تربط الاسم بحاشيته في النسخة المفصّلة (لا تظهر في العادية) — احذفها لإخفاء الحاشية.</p>}
          </>
        )}
        {detailed && chains.length > 0 && Object.keys(notes).length === 0 && (
          <div className="callout">لا توجد تراجم للأعلام في هذا الإسناد — أضفها في صفحة <Link to="/persons">الأعلام</Link> لتظهر في الهامش.</div>
        )}
        {hasDetailed && (
          <div className="row row-wrap">
            <Segmented value={preview} onChange={setPreview} options={[
              { value: 'normal', label: 'العادية — للطباعة (صفحة واحدة)' },
              { value: 'detailed', label: 'المفصّلة — PDF (حواشٍ وشجرة)' },
            ]} />
            <span className="small muted">تصدر النسختان معاً برمز واحد</span>
          </div>
        )}
        {!detailed && fitInfo?.pages > 1 && (
          <div className="alert alert-error">النص أطول من صفحة واحدة حتى بأصغر خط — اختصر القالب أو قلّل الأسانيد المضمّنة.</div>
        )}
        {!detailed && fitInfo && fitInfo.pages === 1 && fitInfo.fit < 0.999 && (
          <div className="small muted">صُغّر الخط إلى {Math.round(fitInfo.fit * 100)}% ليتّسع في صفحة واحدة.</div>
        )}
        <Certificate key={detailed ? 'd' : 'n'} title={title} body={detailed ? bodyDetailed : body} variant={detailed ? 'detailed' : 'normal'}
          notes={notes} chains={treeChains} design={designFinal} people={people} verification={{ placeholder: true }} scale={scale[ver]}
          fitOnePage={!detailed} onFit={info => { setPages(pg => ({ ...pg, [ver]: info.pages })); if (!detailed) setFitInfo(info); }} />
        <p className="small muted">
          الصيغ في نص الإسناد تُضبط من <Link to="/settings">الإعدادات</Link>، ونص الإجازة من تبويب «القوالب». بعد «حفظ وإصدار» تُفتح الإجازة برمزها (QR) للطباعة أو الحفظ كـ PDF.
        </p>
      </div>
    </div>
    </>
  );
}
