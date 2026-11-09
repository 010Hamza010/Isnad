import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { useUI } from '../../components/ui/UIProvider';
import Icon from '../../components/ui/Icon';
import Segmented from '../../components/ui/Segmented';
import Certificate from '../../components/ijaza/Certificate';
import FrozenDocument from '../../components/ijaza/FrozenDocument';
import { buildFrozenDocument, shortHash } from '../../utils/frozenDoc';

const kb = n => `${Math.round((n || 0) / 1024)} ك.ب`;
// fields of a row for each version's PDF
const pdfOf = (row, variant) => (variant === 'detailed'
  ? { sha: row.pdf_detailed_sha256, size: row.pdf_detailed_size, name: row.pdf_detailed_filename }
  : { sha: row.pdf_sha256, size: row.pdf_size, name: row.pdf_filename });

/**
 * One version of an issued ijaza, as archived. The first time it is shown its pages are laid out
 * once and frozen (exact document + SHA-256), then a PDF is made from that frozen document; after
 * that the frozen document is shown and printed as-is.
 *   variant 'normal'   — the printed version, fitted to one page (dual ijazat)
 *   variant 'detailed' — footnotes + tree, sent as PDF
 */
function VersionArchive({ row, settings, profile, variant, renderAs, fitOnePage, onChanged, autoPrint, active }) {
  const { toast, notifyError } = useUI();
  const [doc, setDoc] = useState(null);         // { html, hash, frozen_at } | null
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [making, setMaking] = useState(false);
  const frame = useRef(null);
  const file = useRef(null);
  const q = `?variant=${variant}`;
  const pdf = pdfOf(row, variant);
  const label = variant === 'detailed' ? 'المفصّلة' : 'العادية';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/ijazat/${row.id}/document${q}`)
      .then(r => alive && setDoc(r.data))
      .catch(e => { if (alive && e.response?.status !== 404) notifyError(e); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [row.id, variant]);

  const design = row.details?.design || settings.designs.find(x => x.id === settings.default_design) || settings.designs[0];

  // not archived yet (just issued, or issued before archiving existed): freeze what is rendered now
  const freeze = async sheetsEl => {
    if (doc || freezing) return;
    setFreezing(true);
    try {
      const html = await buildFrozenDocument(sheetsEl, design); // embeds the fonts (downloads them once)
      const { data } = await api.post(`/ijazat/${row.id}/freeze`, { html, variant });
      setDoc({ html, hash: data.content_hash, frozen_at: new Date().toISOString() });
      onChanged?.({ id: row.id, [variant === 'detailed' ? 'detailed_hash' : 'content_hash']: data.content_hash });
    } catch (e) {
      if (e.response?.status === 409) {            // archived meanwhile (another tab): load it
        const r = await api.get(`/ijazat/${row.id}/document${q}`); setDoc(r.data);
      } else if (!e.response) {
        toast('تعذّر تنزيل الخطوط لتضمينها — تحقق من الاتصال ثم أعد فتح الإجازة', 'error');
      } else notifyError(e);
    } finally { setFreezing(false); }
  };

  const sendPdf = async (blob, name) => {
    const { data } = await api.post(`/ijazat/${row.id}/pdf${q}`, blob, {
      headers: { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(name) },
    });
    onChanged?.({ id: row.id, ...data }); // a patch: the two versions update the row independently
  };

  const uploadPdf = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try { await sendPdf(f, f.name); toast('أُرفق ملف PDF — لا يمكن استبداله بعد الآن'); }
    catch (err) { notifyError(err); } finally { setUploading(false); }
  };

  // the PDF of this version is made automatically from its frozen document, once
  const makePdf = async () => {
    if (making || pdf.sha) return;
    setMaking(true);
    try {
      const blob = await frame.current.toPdf();
      await sendPdf(blob, `إجازة ${row.student_name} ${row.short_code}${variant === 'detailed' ? ' مفصّلة' : ''}.pdf`);
      toast(`حُفظت نسخة PDF ${label}`);
    } catch (err) {
      if (err.response?.status === 409) return;
      if (err.response) notifyError(err); else toast('تعذّر إنشاء PDF — يمكنك إعادة المحاولة', 'error');
    } finally { setMaking(false); }
  };

  // the PDF needs the login token, so it is fetched and handed to the browser as a blob
  const openPdf = async download => {
    try {
      const { data } = await api.get(`/ijazat/${row.id}/pdf${q}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      if (download) Object.assign(document.createElement('a'), { href: url, download: pdf.name || 'ijaza.pdf' }).click();
      else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { notifyError(e); }
  };

  const started = useRef({ pdf: false, print: false });
  const onFrameReady = () => {
    if (!pdf.sha && !started.current.pdf) { started.current.pdf = true; setTimeout(makePdf, 500); }
    if (autoPrint && !started.current.print) { started.current.print = true; setTimeout(() => frame.current?.print(), 300); }
  };

  return (
    <div className="stack" style={active ? undefined : { position: 'absolute', left: -10000, top: 0, width: 900 }} aria-hidden={!active}>
      <div className="card card-pad archive-box">
        {doc ? (
          <>
            <span className="badge badge-success"><Icon name="check" size={12} /> النسخة الأصلية محفوظة</span>
            <span>البصمة <code title={doc.hash}>{shortHash(doc.hash)}</code></span>
            {doc.frozen_at && <span className="muted">{String(doc.frozen_at).slice(0, 10)}</span>}
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={() => frame.current?.print()} title="طباعة هذه النسخة"><Icon name="print" size={14} /> طباعة</button>
          </>
        ) : (
          <span className="muted"><span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> {loading ? 'تحميل…' : 'حفظ النسخة الأصلية…'}</span>
        )}
      </div>

      <div className="card card-pad archive-box">
        <Icon name="save" size={16} />
        {pdf.sha ? (
          <>
            <span>PDF: <strong>{pdf.name}</strong> ({kb(pdf.size)})</span>
            <span>البصمة <code title={pdf.sha}>{shortHash(pdf.sha)}</code></span>
            <span className="spacer" />
            <button className="btn btn-secondary btn-sm" onClick={() => openPdf(false)} title="فتح ملف PDF في نافذة جديدة"><Icon name="eye" size={14} /> عرض</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openPdf(true)} title="تنزيل ملف PDF">تنزيل</button>
          </>
        ) : (
          <>
            {making
              ? <span className="muted"><span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> جارٍ إنشاء PDF…</span>
              : <span className="muted">يُنشأ PDF تلقائياً من النسخة المحفوظة، مرة واحدة ولا يُستبدل.</span>}
            <span className="spacer" />
            {doc && !making && <button className="btn btn-secondary btn-sm" onClick={makePdf} title="إنشاء PDF من النسخة الأصلية">إنشاء PDF</button>}
            <input ref={file} type="file" accept="application/pdf" hidden onChange={uploadPdf} />
            <button className="btn btn-ghost btn-sm" disabled={uploading || making} onClick={() => file.current?.click()} title="أو أرفق ملف PDF بنفسك">
              {uploading ? <span className="spinner" /> : 'إرفاق ملف'}
            </button>
          </>
        )}
      </div>

      {doc ? <FrozenDocument ref={frame} html={doc.html} onReady={onFrameReady} /> : !loading && (
        <Certificate title={row.title} body={row.body} variant={renderAs}
          notes={row.details?.notes || {}} chains={row.details?.chains || []} design={design}
          people={row.details?.people || { student: row.student_name, shaykh: settings.shaykh_name, me: profile.short_name || settings.shaykh_name }}
          verification={{ payload: row.qr_payload, code: row.short_code }}
          fitOnePage={fitOnePage} onRendered={freeze} />
      )}
    </div>
  );
}

/**
 * An issued ijaza. Ijazat issued in two versions show both (normal to print, detailed to send);
 * older ones show their single version.
 */
export default function ArchiveView({ row, settings, profile = {}, onChanged, autoPrint = false }) {
  const dual = !!row.details?.dual;
  const [tab, setTab] = useState('normal');
  const common = { row, settings, profile, onChanged };

  if (!dual) {
    return <VersionArchive {...common} variant="normal" renderAs={row.style} autoPrint={autoPrint} active />;
  }
  return (
    <div className="stack" style={{ position: 'relative' }}>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'normal', label: 'العادية — للطباعة' },
        { value: 'detailed', label: 'المفصّلة — PDF للإرسال' },
      ]} />
      {/* both stay mounted so both versions are archived on first opening */}
      <VersionArchive {...common} variant="normal" renderAs="normal" fitOnePage autoPrint={autoPrint} active={tab === 'normal'} />
      <VersionArchive {...common} variant="detailed" renderAs="detailed" active={tab === 'detailed'} />
    </div>
  );
}
