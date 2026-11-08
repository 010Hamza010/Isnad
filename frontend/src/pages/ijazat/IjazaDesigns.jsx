import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import { useUI } from '../../components/ui/UIProvider';
import { Field } from '../../components/ui/Field';
import Segmented from '../../components/ui/Segmented';
import Icon from '../../components/ui/Icon';
import Certificate from '../../components/ijaza/Certificate';
import QRCode from 'qrcode';

const COLOR_GROUPS = [
  { title: 'الورقة والنص', keys: { paper: 'لون الورقة', text: 'النص' } },
  { title: 'العنوان والإطار', keys: { title: 'العنوان', ornament: 'الزخرفة', frame: 'الإطار', frameInner: 'الإطار الداخلي' } },
  { title: 'الأسماء', keys: { shaykh: 'اسمك (المجيز)', student: 'اسم المجاز', names: 'أسماء الشيوخ', sacred: 'النبي ﷺ وجبريل', death: 'تاريخ الوفاة', tahwil: 'التحويل «ح»' } },
  { title: 'الحواشي', keys: { noteRef: 'رقم الحاشية', noteText: 'نص الحاشية', rule: 'خط الحاشية' } },
  { title: 'الشجرة', keys: { treeLine: 'الخطوط', treeNode: 'المربعات', treeNodeBorder: 'حدود المربعات', treeText: 'الأسماء', treeMe: 'أنا', treeSource: 'المصدر (أعلى الشجرة)', treeJoin: 'نقاط الالتقاء' } },
  { title: 'ألوان طرق التحمل في الشجرة', keys: { txSama: 'سماع', txQiraa: 'قراءة', txIjaza: 'إجازة', txArd: 'عرض', txOther: 'غير محدد' } },
];
const FONT_ROLES = { title: 'العنوان', body: 'النص', notes: 'الحواشي', tree: 'الشجرة' };
const FRAME_LABELS = { double: 'مزدوج', single: 'مفرد', none: 'بلا إطار' };

// sample content for the live preview
const SAMPLE = {
  title: 'إجازة في متن «الآجرومية»',
  people: { student: 'أحمد بن علي', shaykh: 'الفقير إلى ربه محمد بن عبد الله' },
  body: 'بسم الله الرحمن الرحيم\n\nالحمد لله الذي جعل الإسناد من الدين، والصلاة والسلام على سيدنا محمد وعلى آله وصحبه أجمعين.\n\n'
    + 'أما بعد، فإن أحمد بن علي قد قرأ عليّ متن «الآجرومية» للإمام ابن آجروم، فأجزته به بشرطه المعتبر.\n\n'
    + 'وإسنادي فيه: قرأتُ على شيخنا محمد عبد الحي الكتاني (ت 1382هـ)[[1]]، وهو سمع من جعفر الكتاني (ت 1323هـ)[[2]] '
    + 'ح وقُرئ على شيخنا محمد بن عبد الكبير (ت 1327هـ)[[3]] وأنا أسمع، كلاهما عن إدريس العراقي (ت 1183هـ)، وهو يروي عن ابن آجروم (ت 723هـ).\n\n'
    + 'وكتبه: الفقير إلى ربه محمد بن عبد الله\nفاس، في 17 جمادى الأولى 1448هـ',
  notes: {
    1: { name: 'محمد عبد الحي الكتاني', death_year: '1382', description: 'مسند المغرب، صاحب فهرس الفهارس والأثبات، من أوسع أهل عصره رواية.' },
    2: { name: 'جعفر الكتاني', death_year: '1323', description: 'فقيه محدث، والد الشيخ عبد الحي، له مؤلفات في الحديث والأنساب.' },
    3: { name: 'محمد بن عبد الكبير الكتاني', death_year: '1327', description: 'عالم صوفي فاسي، أخو الشيخ عبد الحي.' },
  },
  chains: [
    [
      { from_person_id: 0, to_person_id: 1, to_name: 'محمد عبد الحي الكتاني', to_death_year: '1382', tx_name: 'قراءة على الشيخ' },
      { from_person_id: 1, to_person_id: 2, to_name: 'جعفر الكتاني', to_death_year: '1323', tx_name: 'سماع' },
      { from_person_id: 2, to_person_id: 4, to_name: 'إدريس العراقي', to_death_year: '1183', tx_name: null },
      { from_person_id: 4, to_person_id: 5, to_name: 'ابن آجروم', to_death_year: '723', tx_name: 'إجازة' },
    ],
    [
      { from_person_id: 0, to_person_id: 3, to_name: 'محمد بن عبد الكبير', to_death_year: '1327', tx_name: 'قراءة عليه وأنا أسمع' },
      { from_person_id: 3, to_person_id: 4, to_name: 'إدريس العراقي', to_death_year: '1183', tx_name: null },
      { from_person_id: 4, to_person_id: 5, to_name: 'ابن آجروم', to_death_year: '723', tx_name: 'إجازة' },
    ],
  ],
};

const newId = () => `d-${Date.now().toString(36)}`;

// How big one QR square prints, for a typical payload (code, ~25-letter name, long subject, date, signature):
// phones read ≥ 0.35 mm comfortably, ≥ 0.3 mm in good light.
const TYPICAL_QR = QRCode.create('ISN-7K3Q-9P2M\nحمزة بن محمد الطيب شنتير\nالقرآن الكريم برواية ورش عن نافع\n2026-11-08 10:32\ncmbYsPThyUccUZiD', { errorCorrectionLevel: 'L' });
const qrHint = sizeMm => {
  const mm = sizeMm / (TYPICAL_QR.modules.size + 4); // + quiet zone (2 squares each side)
  const note = mm >= 0.35 ? 'يُقرأ بسهولة' : mm >= 0.3 ? 'يُقرأ في إضاءة جيدة' : 'صغير جداً — قد لا يُقرأ';
  return `المربع الواحد ≈ ${mm.toFixed(2)} مم — ${note}`;
};

export default function IjazaDesigns({ settings, options, onSaved }) {
  const { toast, notifyError, confirm } = useUI();
  const [draft, setDraft] = useState({ designs: settings.designs, default_design: settings.default_design });
  const [current, setCurrent] = useState(settings.default_design);
  const [variant, setVariant] = useState('detailed');
  const [saving, setSaving] = useState(false);

  const design = draft.designs.find(d => d.id === current) || draft.designs[0];
  const dirty = JSON.stringify(draft) !== JSON.stringify({ designs: settings.designs, default_design: settings.default_design });

  const update = patch => setDraft(dr => ({ ...dr, designs: dr.designs.map(d => (d.id === design.id ? patch(d) : d)) }));
  const setColor = (k, v) => update(d => ({ ...d, colors: { ...d.colors, [k]: v } }));
  const setFont  = (k, f, v) => update(d => ({ ...d, fonts: { ...d.fonts, [k]: { ...d.fonts[k], [f]: v } } }));
  const setFrame = (k, v) => update(d => ({ ...d, frame: { ...d.frame, [k]: v } }));

  const duplicate = () => {
    const copy = { ...JSON.parse(JSON.stringify(design)), id: newId(), name: `${design.name} (نسخة)` };
    setDraft(dr => ({ ...dr, designs: [...dr.designs, copy] }));
    setCurrent(copy.id);
  };
  const remove = async () => {
    if (draft.designs.length === 1) return toast('يجب أن يبقى تصميم واحد على الأقل', 'error');
    const ok = await confirm({ title: 'حذف التصميم', message: `«${design.name}»`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    const rest = draft.designs.filter(d => d.id !== design.id);
    setDraft(dr => ({ designs: rest, default_design: dr.default_design === design.id ? rest[0].id : dr.default_design }));
    setCurrent(rest[0].id);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/ijazat/settings', { ...settings, ...draft });
      onSaved(data.settings);
      setDraft({ designs: data.settings.designs, default_design: data.settings.default_design });
      toast('تم حفظ التصاميم');
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  };

  const previewChains = useMemo(() => SAMPLE.chains, []);

  return (
    <>
      <div className="toolbar">
        <select className="select" style={{ width: 'auto', minWidth: 200 }} value={design.id} onChange={e => setCurrent(e.target.value)}>
          {draft.designs.map(d => <option key={d.id} value={d.id}>{d.name}{d.id === draft.default_design ? ' ★' : ''}</option>)}
        </select>
        <input className="input" style={{ width: 200 }} value={design.name} aria-label="اسم التصميم"
          onChange={e => update(d => ({ ...d, name: e.target.value }))} />
        <button className="btn btn-ghost btn-sm" onClick={duplicate}><Icon name="copy" size={14} /> نسخ</button>
        <button className="btn btn-ghost btn-sm" disabled={design.id === draft.default_design}
          onClick={() => setDraft(dr => ({ ...dr, default_design: design.id }))}><Icon name="star" size={14} /> اجعله الافتراضي</button>
        <button className="btn btn-ghost btn-sm" onClick={remove}><Icon name="trash" size={14} /> حذف</button>
      </div>

      <div className="ijaza-layout">
        <div className="card card-pad designer">
          {COLOR_GROUPS.map(g => (
            <div key={g.title} className="designer-group">
              <div className="section-label">{g.title}</div>
              <div className="swatches">
                {Object.entries(g.keys).map(([k, label]) => (
                  <label key={k} className="swatch">
                    <input type="color" value={design.colors[k]} onChange={e => setColor(k, e.target.value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="section-label">الخطوط والأحجام (نقطة)</div>
          {Object.entries(FONT_ROLES).map(([k, label]) => {
            const [min, max] = options.fontSizes[k];
            return (
              <div key={k} className="font-row">
                <span className="small strong">{label}</span>
                <select className="select" value={design.fonts[k].family} onChange={e => setFont(k, 'family', e.target.value)}
                  style={{ fontFamily: `"${design.fonts[k].family}"` }}>
                  {options.fonts.map(f => <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>)}
                </select>
                <input className="input" type="number" min={min} max={max} step="0.5" value={design.fonts[k].size}
                  onChange={e => setFont(k, 'size', Number(e.target.value))} aria-label={`حجم ${label}`} />
              </div>
            );
          })}
          <label className="check" style={{ margin: '6px 0 4px' }}>
            <input type="checkbox" checked={design.boldNames} onChange={e => update(d => ({ ...d, boldNames: e.target.checked }))} />
            الأسماء بخط عريض
          </label>

          <div className="section-label">رمز التحقق (QR)</div>
          <label className="check" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={design.qr?.show !== false} onChange={e => update(d => ({ ...d, qr: { ...d.qr, show: e.target.checked } }))} />
            إظهار رمز QR ورمز التحقق بعد التوقيع
          </label>
          <Field label={`حجم الرمز: ${design.qr?.sizeMm ?? 20} مم`} hint={qrHint(design.qr?.sizeMm ?? 20)}>
            <input type="range" min="14" max="40" value={design.qr?.sizeMm ?? 20}
              onChange={e => update(d => ({ ...d, qr: { ...d.qr, sizeMm: Number(e.target.value) } }))} />
          </Field>

          <div className="section-label">الإطار والصفحة</div>
          <div className="field">
            <Segmented value={design.frame.style} onChange={v => setFrame('style', v)}
              options={options.frames.map(f => ({ value: f, label: FRAME_LABELS[f] }))} />
          </div>
          <Field label="الزخرفة فوق العنوان" hint="مثل ❁ ❁ ❁ أو ۞ — اتركها فارغة لحذفها">
            <input className="input" value={design.frame.ornament} onChange={e => setFrame('ornament', e.target.value)} />
          </Field>
          <div className="form-grid">
            <Field label={`بُعد الإطار عن الحافة: ${design.frame.marginMm} مم`}>
              <input type="range" min="0" max="30" value={design.frame.marginMm} onChange={e => setFrame('marginMm', Number(e.target.value))} />
            </Field>
            <Field label={`المسافة داخل الإطار: ${design.frame.paddingMm} مم`}>
              <input type="range" min="6" max="40" value={design.frame.paddingMm} onChange={e => setFrame('paddingMm', Number(e.target.value))} />
            </Field>
          </div>
        </div>

        <div className="stack">
          <div className="row">
            <span className="small muted spacer">معاينة بنص تجريبي</span>
            <Segmented value={variant} onChange={setVariant} options={[{ value: 'normal', label: 'عادية' }, { value: 'detailed', label: 'مفصّلة' }]} />
          </div>
          <Certificate title={SAMPLE.title} body={SAMPLE.body} variant={variant} notes={SAMPLE.notes}
            chains={previewChains} design={design} people={SAMPLE.people}
            verification={{ code: 'ISN-7K3Q-9P2M', payload: 'إجازة — إسناد\nالرمز: ISN-7K3Q-9P2M\nالمجاز: أحمد بن علي\nالموضوع: إجازة في متن «الآجرومية»\nالتاريخ: 2026-11-08 10:32\nالتوقيع: 0000000000000000000000' }} />
        </div>
      </div>

      {dirty && (
        <div className="savebar">
          <Icon name="alert" size={16} /><span className="spacer small">لديك تغييرات غير محفوظة في التصاميم</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setDraft({ designs: settings.designs, default_design: settings.default_design })}>تراجع</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'حفظ'}</button>
        </div>
      )}
    </>
  );
}
