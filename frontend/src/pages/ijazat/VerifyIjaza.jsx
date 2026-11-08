import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { useUI } from '../../components/ui/UIProvider';
import Icon from '../../components/ui/Icon';
import FrozenDocument from '../../components/ijaza/FrozenDocument';
import { shortHash } from '../../utils/frozenDoc';

const STATUS = {
  valid:   { icon: 'check', title: 'إجازة صحيحة', text: 'الرمز موقّع، والبيانات مطابقة لما في سجلك.' },
  revoked: { icon: 'x',     title: 'إجازة ملغاة', text: 'الرمز صحيح، لكنك ألغيت هذه الإجازة.' },
  altered: { icon: 'alert', title: 'بيانات مختلفة', text: 'بيانات الرمز لا تطابق السجل أو التوقيع غير صحيح — قد تكون مزوّرة أو معدّلة.' },
  unknown: { icon: 'alert', title: 'غير موجودة', text: 'لا توجد في سجلك إجازة بهذا الرمز.' },
  invalid: { icon: 'alert', title: 'ليس رمز إجازة', text: 'هذا الرمز ليس من رموز إجازات إسناد.' },
};

// BarcodeDetector: built into Chrome on Android / macOS / ChromeOS; elsewhere paste the text instead
const detector = () => ('BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null);

/** Dashboard page: verify an ijaza from its QR (camera, photo or pasted text) or its short code. */
export default function VerifyIjaza() {
  const { notifyError } = useUI();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [original, setOriginal] = useState(null);
  const video = useRef(null);
  const photo = useRef(null);
  const canScan = 'BarcodeDetector' in window;

  const verify = async input => {
    const value = String(input ?? text).trim();
    if (!value) return;
    setBusy(true); setResult(null); setOriginal(null);
    try {
      const body = /\n|التوقيع/.test(value) ? { payload: value } : { code: value };
      const { data } = await api.post('/ijazat/verify', body);
      setResult(data);
      if (data.ijaza?.content_hash) {
        api.get(`/ijazat/${data.ijaza.id}/document`).then(r => setOriginal(r.data.html)).catch(() => {});
      }
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  // camera scanning loop
  useEffect(() => {
    if (!camera) return;
    let stream, timer, alive = true;
    const det = detector();
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s;
        if (!alive || !video.current) return;
        video.current.srcObject = s;
        video.current.play();
        timer = setInterval(async () => {
          try {
            const [code] = await det.detect(video.current);
            if (code?.rawValue) { setText(code.rawValue); setCamera(false); verify(code.rawValue); }
          } catch { /* frame not ready */ }
        }, 350);
      })
      .catch(() => { setCamera(false); notifyError({ response: { status: 400, data: { error: 'تعذّر تشغيل الكاميرا' } } }); });
    return () => { alive = false; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [camera]);

  const fromPhoto = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const [code] = await detector().detect(await createImageBitmap(f));
      if (!code) throw new Error();
      setText(code.rawValue); verify(code.rawValue);
    } catch { notifyError({ response: { status: 400, data: { error: 'لم يُعثر على رمز QR في الصورة' } } }); }
  };

  const st = result && STATUS[result.status];
  const i = result?.ijaza;

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="card card-pad stack">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">بيانات رمز QR أو رمز الإجازة</span>
          <textarea className="textarea" rows={6} value={text} onChange={e => setText(e.target.value)}
            placeholder={'الصق النص الذي يظهر عند مسح الرمز، أو اكتب الرمز مثل ISN-7K3Q-9P2M'} />
        </label>
        <div className="row row-wrap">
          <button className="btn btn-primary" onClick={() => verify()} disabled={busy || !text.trim()}>
            {busy ? <span className="spinner" /> : <Icon name="check" size={16} />} تحقق
          </button>
          {canScan && <>
            <button className="btn btn-secondary" onClick={() => setCamera(c => !c)}>{camera ? 'إيقاف الكاميرا' : 'مسح بالكاميرا'}</button>
            <input ref={photo} type="file" accept="image/*" hidden onChange={fromPhoto} />
            <button className="btn btn-secondary" onClick={() => photo.current?.click()}>من صورة</button>
          </>}
          {!canScan && <span className="small muted">المسح بالكاميرا غير مدعوم في هذا المتصفح — امسح الرمز بهاتفك والصق النص هنا.</span>}
        </div>
        {camera && <video ref={video} className="verify-video" playsInline muted />}
      </div>

      {result && (
        <>
          <div className={`verify-status ${result.status}`}>
            <Icon name={st.icon} size={28} />
            <div>
              <div className="verify-title">{st.title}</div>
              <div>{result.message || st.text}
                {result.status === 'revoked' && i?.revoke_reason ? ` — ${i.revoke_reason}` : ''}</div>
            </div>
          </div>

          {result.checks?.length > 0 && (
            <div className="card card-pad">
              <div className="section-label">مقارنة بيانات الرمز بالسجل</div>
              {result.checks.map(c => (
                <div key={c.field} className="check-row">
                  <Icon name={c.ok ? 'check' : 'x'} size={16} style={{ color: c.ok ? 'var(--success)' : 'var(--danger)' }} />
                  <strong>{c.field}</strong>
                  <span>{c.ok ? (c.stored || 'صحيح') : c.field === 'التوقيع' ? 'التوقيع غير صحيح' : <>في الرمز: «{c.scanned}» — في السجل: «{c.stored}»</>}</span>
                </div>
              ))}
            </div>
          )}

          {i && (
            <dl className="card card-pad verify-summary">
              <div><dt>المجاز</dt><dd>{i.student_name}</dd></div>
              <div><dt>الإجازة</dt><dd>{i.title || '—'}</dd></div>
              <div><dt>التاريخ</dt><dd>{[i.issued_hijri, String(i.issued_at).slice(0, 10)].filter(Boolean).join(' — ')}</dd></div>
              <div><dt>الرمز</dt><dd dir="ltr">{i.short_code}</dd></div>
              <div><dt>مرات التحقق</dt><dd>{i.scan_count}</dd></div>
              {i.replaced_by_code && <div><dt>صدرت بدلها</dt><dd dir="ltr">{i.replaced_by_code}</dd></div>}
              {i.replaces_code && <div><dt>تصحيح للإجازة</dt><dd dir="ltr">{i.replaces_code}</dd></div>}
              {i.content_hash && <div><dt>بصمة النسخة الأصلية</dt><dd><code title={i.content_hash}>{shortHash(i.content_hash)}</code></dd></div>}
              {i.pdf_sha256 && <div><dt>بصمة PDF المسلَّم</dt><dd><code title={i.pdf_sha256}>{shortHash(i.pdf_sha256)}</code></dd></div>}
            </dl>
          )}

          {original && (
            <>
              <div className="section-label">النسخة الأصلية كما صدرت</div>
              <FrozenDocument html={original} />
            </>
          )}
        </>
      )}
    </div>
  );
}
