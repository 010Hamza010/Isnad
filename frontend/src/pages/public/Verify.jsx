import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/api';
import { errorMessage } from '../../components/ui/UIProvider';
import Icon from '../../components/ui/Icon';
import Certificate from '../../components/ijaza/Certificate';
import IsnadProse from '../../components/isnad/IsnadProse';

const fmtDate = d => String(d ?? '').slice(0, 10);

/**
 * Public verification page (no login): opened by scanning the QR on a printed ijaza,
 * or by typing the short code printed under it.
 */
export default function Verify() {
  const { token } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState({ loading: !!token, data: null, error: '' });
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!token) return;
    setState({ loading: true, data: null, error: '' });
    const preview = new URLSearchParams(window.location.search).get('preview') === '1' ? '?preview=1' : '';
    const url = token.startsWith('ISN-') ? `/public/ijazat/code/${encodeURIComponent(token)}` : `/public/ijazat/${encodeURIComponent(token)}`;
    api.get(url + preview)
      .then(r => setState({ loading: false, data: r.data, error: '' }))
      .catch(e => setState({ loading: false, data: null, error: errorMessage(e) }));
  }, [token]);

  const lookup = e => { e.preventDefault(); if (code.trim()) nav(`/v/${encodeURIComponent(code.trim().toUpperCase())}`); };
  const d = state.data;
  const valid = d?.status === 'valid';

  return (
    <div className="verify-page">
      <header className="verify-head">
        <div className="brand-mark">س</div>
        <div><div className="brand-name">إسناد</div><div className="brand-tag">التحقق من إجازة</div></div>
      </header>

      {!token && (
        <form className="card card-pad verify-form" onSubmit={lookup}>
          <label className="field">
            <span className="field-label">رمز التحقق المطبوع تحت رمز QR</span>
            <input className="input" dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="ISN-XXXX-XXXX" autoFocus />
          </label>
          <button className="btn btn-primary btn-block">تحقق</button>
        </form>
      )}

      {state.loading && <div className="skeleton" style={{ height: 160 }} />}

      {state.error && (
        <div className="verify-status invalid">
          <Icon name="alert" size={28} />
          <div><div className="verify-title">لم يُعثر على هذه الإجازة</div><div>{state.error}</div></div>
        </div>
      )}

      {d && (
        <>
          <div className={`verify-status ${valid ? 'valid' : 'revoked'}`}>
            <Icon name={valid ? 'check' : 'x'} size={28} />
            <div>
              <div className="verify-title">{valid ? 'إجازة صحيحة' : 'إجازة ملغاة'}</div>
              <div>
                {valid ? 'صادرة ومسجّلة لدى المجيز. قارن النص أدناه بالنسخة المطبوعة.'
                  : `ألغاها المجيز${d.revoked_at ? ` في ${fmtDate(d.revoked_at)}` : ''}${d.revoke_reason ? ` — ${d.revoke_reason}` : ''}.`}
              </div>
            </div>
          </div>

          <dl className="card card-pad verify-summary">
            <div><dt>المجاز</dt><dd>{d.student_name}</dd></div>
            <div><dt>المجيز</dt><dd>{d.shaykh_name || '—'}</dd></div>
            <div><dt>الإجازة</dt><dd>{d.title || '—'}</dd></div>
            <div><dt>التاريخ</dt><dd>{[d.issued_hijri, fmtDate(d.issued_at)].filter(Boolean).join(' — ')}</dd></div>
            {d.place && <div><dt>المكان</dt><dd>{d.place}</dd></div>}
            <div><dt>رمز التحقق</dt><dd dir="ltr">{d.short_code}</dd></div>
          </dl>

          <div className="section-label">نص الإجازة كما صدر</div>
          {d.details?.design ? (
            <Certificate title={d.title} body={d.body} variant={d.style} notes={d.details.notes || {}}
              chains={d.details.chains || []} design={d.details.design} people={d.details.people || {}} />
          ) : (
            <div className="card card-pad isnad-text" style={{ whiteSpace: 'pre-wrap' }}><IsnadProse text={d.body} /></div>
          )}
        </>
      )}
    </div>
  );
}
