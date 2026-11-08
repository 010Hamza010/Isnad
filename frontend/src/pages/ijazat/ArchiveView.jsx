import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { useUI } from '../../components/ui/UIProvider';
import Icon from '../../components/ui/Icon';
import Certificate from '../../components/ijaza/Certificate';
import FrozenDocument from '../../components/ijaza/FrozenDocument';
import { buildFrozenDocument, shortHash } from '../../utils/frozenDoc';

const kb = n => `${Math.round((n || 0) / 1024)} ك.ب`;

/**
 * One issued ijaza, as archived. The first time it is opened its pages are laid out once and
 * frozen (exact document + SHA-256); afterwards the frozen document is shown and printed as-is.
 */
export default function ArchiveView({ row, settings, profile = {}, onChanged, autoPrint = false }) {
  const { toast, notifyError } = useUI();
  const [doc, setDoc] = useState(null);         // { html, hash, frozen_at } | null
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const frame = useRef(null);
  const file = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/ijazat/${row.id}/document`)
      .then(r => alive && setDoc(r.data))
      .catch(e => { if (alive && e.response?.status !== 404) notifyError(e); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [row.id]);

  // not archived yet (just issued, or issued before archiving existed): freeze what is rendered now
  const freeze = async sheetsEl => {
    if (doc || freezing) return;
    setFreezing(true);
    try {
      const html = await buildFrozenDocument(sheetsEl, design); // embeds the fonts (downloads them once)
      const { data } = await api.post(`/ijazat/${row.id}/freeze`, { html });
      setDoc({ html, hash: data.content_hash, frozen_at: new Date().toISOString() });
      onChanged?.({ ...row, content_hash: data.content_hash });
    } catch (e) {
      if (e.response?.status === 409) {           // archived meanwhile (another tab): load it
        const r = await api.get(`/ijazat/${row.id}/document`); setDoc(r.data);
      } else if (!e.response) {
        toast('تعذّر تنزيل الخطوط لتضمينها — تحقق من الاتصال ثم أعد فتح الإجازة', 'error');
      } else notifyError(e);
    } finally { setFreezing(false); }
  };

  const uploadPdf = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try {
      const { data } = await api.post(`/ijazat/${row.id}/pdf`, f, {
        headers: { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(f.name) },
      });
      onChanged?.({ ...row, ...data });
      toast('أُرفق ملف PDF — لا يمكن استبداله بعد الآن');
    } catch (err) { notifyError(err); } finally { setUploading(false); }
  };

  // the PDF needs the login token, so it is fetched and handed to the browser as a blob
  const openPdf = async download => {
    try {
      const { data } = await api.get(`/ijazat/${row.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      if (download) Object.assign(document.createElement('a'), { href: url, download: row.pdf_filename || 'ijaza.pdf' }).click();
      else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { notifyError(e); }
  };

  // «طباعة» from the register: print as soon as the archived document is shown
  const printed = useRef(false);
  const onFrameReady = () => {
    if (autoPrint && !printed.current) { printed.current = true; setTimeout(() => frame.current?.print(), 300); }
  };

  const design = row.details?.design || settings.designs.find(x => x.id === settings.default_design) || settings.designs[0];

  return (
    <div className="stack">
      <div className="card card-pad archive-box">
        {doc ? (
          <>
            <span className="badge badge-success"><Icon name="check" size={12} /> النسخة الأصلية محفوظة</span>
            <span>البصمة <code title={doc.hash}>{shortHash(doc.hash)}</code></span>
            {doc.frozen_at && <span className="muted">{String(doc.frozen_at).slice(0, 10)}</span>}
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={() => frame.current?.print()}><Icon name="print" size={14} /> طباعة / PDF</button>
          </>
        ) : (
          <span className="muted"><span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> {loading ? 'تحميل…' : 'حفظ النسخة الأصلية…'}</span>
        )}
      </div>

      <div className="card card-pad archive-box">
        <Icon name="save" size={16} />
        {row.pdf_sha256 ? (
          <>
            <span>ملف PDF المسلَّم: <strong>{row.pdf_filename}</strong> ({kb(row.pdf_size)})</span>
            <span>البصمة <code title={row.pdf_sha256}>{shortHash(row.pdf_sha256)}</code></span>
            <span className="spacer" />
            <button className="btn btn-secondary btn-sm" onClick={() => openPdf(false)} title="فتح ملف PDF في نافذة جديدة"><Icon name="eye" size={14} /> عرض</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openPdf(true)} title="تنزيل ملف PDF">تنزيل</button>
          </>
        ) : (
          <>
            <span className="muted">أرفق ملف PDF الذي سلّمته للمجاز — يُحفظ مرة واحدة ولا يُستبدل.</span>
            <span className="spacer" />
            <input ref={file} type="file" accept="application/pdf" hidden onChange={uploadPdf} />
            <button className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => file.current?.click()}>
              {uploading ? <span className="spinner" /> : 'إرفاق PDF'}
            </button>
          </>
        )}
      </div>

      {doc ? <FrozenDocument ref={frame} html={doc.html} onReady={onFrameReady} /> : !loading && (
        <Certificate title={row.title} body={row.body} variant={row.style}
          notes={row.details?.notes || {}} chains={row.details?.chains || []} design={design}
          people={row.details?.people || { student: row.student_name, shaykh: settings.shaykh_name, me: profile.short_name || settings.shaykh_name }}
          verification={{ payload: row.qr_payload, code: row.short_code }}
          onRendered={freeze} />
      )}
    </div>
  );
}
