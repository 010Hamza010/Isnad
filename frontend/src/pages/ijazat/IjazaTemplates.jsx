import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useUI } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { PLACEHOLDERS, TITLE_PLACEHOLDERS } from '../../utils/ijaza';
import TitleStyleFields from '../../components/ijaza/TitleStyleFields';

export default function IjazaTemplates({ settings, options, onSaved }) {
  const { toast, notifyError, confirm } = useUI();
  const [draft, setDraft] = useState(settings);
  const [which, setWhich] = useState('mutoon');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const setTpl = v => setDraft(d => ({ ...d, templates: { ...d.templates, [which]: v } }));
  const title = draft.titles?.[which] || { text: '' };
  const setTitle = v => setDraft(d => ({ ...d, titles: { ...d.titles, [which]: { ...title, ...v } } }));
  const defaultDesign = draft.designs.find(x => x.id === draft.default_design) || draft.designs[0];

  // insert {key} at the cursor
  const insert = key => {
    const el = ref.current; const tpl = draft.templates[which];
    const at = el ? el.selectionStart : tpl.length;
    setTpl(`${tpl.slice(0, at)}{${key}}${tpl.slice(el ? el.selectionEnd : at)}`);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + key.length + 2, at + key.length + 2); });
  };

  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put('/ijazat/settings', draft); onSaved(data.settings); setDraft(data.settings); toast('تم حفظ القوالب'); }
    catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const reset = async () => {
    const ok = await confirm({ title: 'استعادة القوالب الافتراضية', message: 'ستُستبدل قوالبك واسمك ومكانك بالقيم الافتراضية.', danger: true, confirmLabel: 'استعادة' });
    if (!ok) return;
    try { const { data } = await api.delete('/ijazat/settings'); onSaved(data.settings); setDraft(data.settings); toast('تمت الاستعادة'); }
    catch (e) { notifyError(e); }
  };

  return (
    <>
      <div className="callout settings-section">
        اسمك الكامل والمختصر وجنسك والمكان الافتراضي في <Link to="/profile">الملف الشخصي</Link>.
      </div>

      <div className="card settings-section">
        <div className="card-head">
          <div className="card-title spacer">نص القالب</div>
          <Segmented value={which} onChange={setWhich} options={[
            { value: 'mutoon', label: 'متن' }, { value: 'quran', label: 'القرآن' }, { value: 'general', label: 'عامة' },
          ]} />
        </div>
        <div className="card-pad">
          <Field label="العنوان" hint="كيف تُكتب «إجازة» في رأس الصفحة لهذا النوع — اضغط Enter لبدء سطر جديد. يمكن تغييره أيضاً لكل إجازة على حدة.">
            <textarea className="textarea" rows={2} style={{ minHeight: 0 }} value={title.text} onChange={e => setTitle({ text: e.target.value })}
              style={{ fontFamily: `"${title.family || defaultDesign.fonts.title.family}"`, color: title.color || defaultDesign.colors.title, fontSize: 20, textAlign: 'center', minHeight: 0 }} />
          </Field>
          <div className="ph-chips" style={{ marginBottom: 10 }}>
            {(which === 'general' ? TITLE_PLACEHOLDERS.filter(p => p.key === 'الطالب') : TITLE_PLACEHOLDERS).map(p => (
              <button key={p.key} type="button" title={p.hint} onClick={() => setTitle({ text: `${title.text}{${p.key}}` })}>{`{${p.key}}`}</button>
            ))}
          </div>
          <TitleStyleFields value={title} onChange={setTitle} options={options} design={defaultDesign} />
          <div className="section-label">نص الإجازة</div>
          <div className="ph-chips">
            {PLACEHOLDERS.map(p => <button key={p.key} type="button" title={p.hint} onClick={() => insert(p.key)}>{`{${p.key}}`}</button>)}
          </div>
          <textarea ref={ref} className="textarea cert-editor" value={draft.templates[which]} onChange={e => setTpl(e.target.value)} />
          {which !== 'general' && (
            <Field label="فقرة الشيوخ الذين قرأت عليهم ({شيوخ_القراءة})"
              hint="تظهر فقط إذا قرأتَ على أكثر من شيخ؛ ضع {الشيوخ} مكان أسمائهم. اتركها فارغة لإلغائها.">
              <input className="input" value={draft.teachers_sentence?.[which] ?? ''}
                onChange={e => setDraft(d => ({ ...d, teachers_sentence: { ...d.teachers_sentence, [which]: e.target.value } }))} />
            </Field>
          )}
          {which !== 'general' && (
            <div className="form-grid">
              <Field label="اللقب قبل اسم كل شيخ" hint="مثل: الشيخ، شيخنا، العلامة">
                <input className="input" value={draft.teachers_title ?? ''}
                  onChange={e => setDraft(d => ({ ...d, teachers_title: e.target.value }))} />
              </Field>
              <Field label="… وقبل اسم الشيخة" hint="مثل: الشيخة، شيختنا">
                <input className="input" value={draft.teachers_title_f ?? ''}
                  onChange={e => setDraft(d => ({ ...d, teachers_title_f: e.target.value }))} />
              </Field>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>
            اترك سطراً فارغاً بين الفقرات. الفقرة الأولى تُوسَّط، والأخيرة (التوقيع) تُحاذى إلى اليسار.<br />
            للمذكر والمؤنث: <code>{'{المجاز:فأجزته|فأجزتها}'}</code> حسب المجاز، و<code>{'{المجيز:وكتبه|وكتبته}'}</code> حسبك.
          </p>
        </div>
      </div>

      {dirty ? (
        <div className="savebar">
          <Icon name="alert" size={16} /><span className="spacer small">لديك تغييرات غير محفوظة</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft(settings)}>تراجع</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'حفظ'}</button>
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={reset}><Icon name="reset" size={14} /> استعادة الافتراضي</button>
        </div>
      )}
    </>
  );
}
