import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import Modal from '../../components/ui/Modal';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Icon from '../../components/ui/Icon';
import Certificate from '../../components/ijaza/Certificate';
import { matches } from '../../utils/text';
import { verifyUrl } from '../../utils/verify';

const MODULE_BADGE = { mutoon: ['متن', 'badge-info'], quran: ['قرآن', 'badge-accent'], general: ['عامة', 'badge-purple'] };

export default function IjazaRegister({ settings, openId, onOpened }) {
  const { toast, notifyError, confirm } = useUI();
  const { data: rows, loading, reload, setData } = useLoad(() => api.get('/ijazat').then(r => r.data), [], []);
  const [search, setSearch] = useState('');
  const [view, setView] = useState(null);
  const [revoking, setRevoking] = useState(null); // { row, reason }

  // open the ijaza that was just issued, ready to print
  useEffect(() => {
    if (!openId || !rows.length) return;
    const r = rows.find(x => x.id === openId);
    if (r) { setView(r); onOpened?.(); }
  }, [openId, rows]);

  const link = r => verifyUrl(r.public_token, settings.public_base_url);
  const replace = row => { setData(list => list.map(x => (x.id === row.id ? row : x))); setView(v => (v?.id === row.id ? row : v)); };

  const copy = async r => {
    try { await navigator.clipboard.writeText(link(r)); toast('نُسخ رابط التحقق'); }
    catch { toast(link(r)); }
  };
  const revoke = async () => {
    try {
      const { data } = await api.post(`/ijazat/${revoking.row.id}/revoke`, { reason: revoking.reason });
      replace(data); setRevoking(null); toast('أُلغيت الإجازة — صفحة التحقق تظهرها «ملغاة»');
    } catch (e) { notifyError(e); }
  };
  const restore = async r => {
    try { const { data } = await api.delete(`/ijazat/${r.id}/revoke`); replace(data); toast('أُعيد تفعيل الإجازة'); }
    catch (e) { notifyError(e); }
  };

  const filtered = rows.filter(r => matches(search, r.student_name, r.title, r.matn_title, r.riwaya_name));

  const del = async r => {
    const ok = await confirm({ title: 'حذف من السجل', message: `إجازة «${r.student_name}» — ${r.title || ''}`, danger: true, confirmLabel: 'حذف' });
    if (!ok) return;
    try { await api.delete(`/ijazat/${r.id}`); toast('تم الحذف'); reload(); } catch (e) { notifyError(e); }
  };

  return (
    <>
      <div className="toolbar">
        <SearchInput className="search" value={search} onChange={setSearch} placeholder="ابحث باسم المجاز أو المتن…" />
        <span className="small muted">{rows.length} إجازة</span>
      </div>

      {loading && !rows.length ? <SkeletonList /> : filtered.length === 0 ? (
        <EmptyState icon="award" title={search ? 'لا نتائج' : 'لم تصدر إجازات بعد'} subtitle={search ? undefined : 'الإجازات التي تحفظها تظهر هنا'} />
      ) : (
        <div className="list">
          {filtered.map(r => {
            const [label, cls] = MODULE_BADGE[r.module] || ['', ''];
            return (
              <div key={r.id} className="list-item">
                <div className="avatar">{r.student_name.slice(0, 1)}</div>
                <div className="list-main">
                  <div className="row row-wrap" style={{ gap: 6 }}>
                    <span className="list-title display" style={{ fontSize: 17 }}>{r.student_name}</span>
                    <span className={`badge ${cls}`}>{label}</span>
                    {r.style === 'detailed' && <span className="badge">مفصّلة</span>}
                    {r.revoked_at && <span className="badge badge-danger">ملغاة</span>}
                  </div>
                  <div className="list-sub">{[r.title, r.issued_hijri || String(r.issued_at).slice(0, 10), r.place].filter(Boolean).join(' · ')}</div>
                  <div className="list-sub row" style={{ gap: 10 }}>
                    <span dir="ltr" className="strong">{r.short_code}</span>
                    <span title={r.last_scanned_at ? `آخر تحقق: ${String(r.last_scanned_at).slice(0, 16).replace('T', ' ')}` : undefined}>
                      <Icon name="eye" size={12} /> {r.scan_count || 0} تحقق
                    </span>
                  </div>
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setView(r)} aria-label="عرض وطباعة"><Icon name="print" size={16} /></button>
                  <button className="icon-btn" onClick={() => copy(r)} aria-label="نسخ رابط التحقق"><Icon name="link" size={16} /></button>
                  <a className="icon-btn" href={`${link(r)}?preview=1`} target="_blank" rel="noreferrer" aria-label="فتح صفحة التحقق"><Icon name="globe" size={16} /></a>
                  {r.revoked_at
                    ? <button className="icon-btn" onClick={() => restore(r)} aria-label="إعادة التفعيل" title="إعادة التفعيل"><Icon name="reset" size={16} /></button>
                    : <button className="icon-btn danger" onClick={() => setRevoking({ row: r, reason: '' })} aria-label="إلغاء الإجازة" title="إلغاء الإجازة"><Icon name="x" size={16} /></button>}
                  <button className="icon-btn danger" onClick={() => del(r)} aria-label="حذف"><Icon name="trash" size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && (
        <Modal title={view.student_name} size="lg" onClose={() => setView(null)}
          footer={<button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة / PDF</button>}>
          <Certificate title={view.title} body={view.body} variant={view.style}
            notes={view.details?.notes || {}} chains={view.details?.chains || []}
            design={view.details?.design || settings.designs.find(x => x.id === settings.default_design) || settings.designs[0]}
            people={view.details?.people || { student: view.student_name, shaykh: settings.shaykh_name }}
            verification={{ url: link(view), code: view.short_code }} />
        </Modal>
      )}

      {revoking && (
        <Modal title={`إلغاء إجازة «${revoking.row.student_name}»`} size="sm" onClose={() => setRevoking(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setRevoking(null)}>تراجع</button>
            <button className="btn btn-danger" onClick={revoke}>إلغاء الإجازة</button>
          </>}>
          <p className="muted small" style={{ marginBottom: 10 }}>
            تبقى في السجل، لكن من يمسح رمزها يرى أنها «ملغاة». يمكنك إعادة تفعيلها لاحقاً.
          </p>
          <label className="field">
            <span className="field-label">السبب (يظهر في صفحة التحقق، اختياري)</span>
            <input className="input" value={revoking.reason} maxLength={255}
              onChange={e => setRevoking(v => ({ ...v, reason: e.target.value }))} placeholder="مثال: خطأ في اسم المجاز، صدرت بدلها إجازة جديدة" />
          </label>
        </Modal>
      )}
    </>
  );
}
