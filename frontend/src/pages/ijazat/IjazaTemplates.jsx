import React, { useRef, useState } from 'react';
import api from '../../utils/api';
import { useUI } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import { PLACEHOLDERS } from '../../utils/ijaza';

export default function IjazaTemplates({ settings, onSaved }) {
  const { toast, notifyError, confirm } = useUI();
  const [draft, setDraft] = useState(settings);
  const [which, setWhich] = useState('mutoon');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const setTpl = v => setDraft(d => ({ ...d, templates: { ...d.templates, [which]: v } }));

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
      <div className="card card-pad settings-section">
        <div className="form-grid">
          <Field label="اسمك كما يُكتب في الإجازة" hint="يظهر في موضع {المجيز}">
            <input className="input" value={draft.shaykh_name} onChange={e => setDraft(d => ({ ...d, shaykh_name: e.target.value }))} placeholder="الفقير إلى ربه فلان بن فلان" />
          </Field>
          <Field label="المكان الافتراضي">
            <input className="input" value={draft.place} onChange={e => setDraft(d => ({ ...d, place: e.target.value }))} />
          </Field>
        </div>
      </div>

      <div className="card settings-section">
        <div className="card-head">
          <div className="card-title spacer">نص القالب</div>
          <Segmented value={which} onChange={setWhich} options={[
            { value: 'mutoon', label: 'متن' }, { value: 'quran', label: 'القرآن' }, { value: 'general', label: 'عامة' },
          ]} />
        </div>
        <div className="card-pad">
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
            <Field label="اللقب قبل اسم كل شيخ في هذه الفقرة" hint="مثل: الشيخ، شيخنا، العلامة">
              <input className="input" style={{ maxWidth: 240 }} value={draft.teachers_title ?? ''}
                onChange={e => setDraft(d => ({ ...d, teachers_title: e.target.value }))} />
            </Field>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>اترك سطراً فارغاً بين الفقرات. الفقرة الأولى تُوسَّط، والأخيرة (التوقيع) تُحاذى إلى اليسار.</p>
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
