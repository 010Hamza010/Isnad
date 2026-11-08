import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import Modal from '../../components/ui/Modal';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Icon from '../../components/ui/Icon';
import ArchiveView from './ArchiveView';
import { matches } from '../../utils/text';

const MODULE_BADGE = { mutoon: ['متن', 'badge-info'], quran: ['قرآن', 'badge-accent'], general: ['عامة', 'badge-purple'] };

export default function IjazaRegister({ settings, profile, openId, onOpened, onCorrect }) {
  const { toast, notifyError, confirm } = useUI();
  const { data: rows, loading, reload, setData } = useLoad(() => api.get('/ijazat').then(r => r.data), [], []);
  const [search, setSearch] = useState('');
  const [view, setView] = useState(null);
  const [revoking, setRevoking] = useState(null); // { row, reason }

  // open the ijaza that was just issued, ready to print
  useEffect(() => {
    if (!openId || !rows.length) return;
    const r = rows.find(x => x.id === openId);
    if (r) { setView({ row: r }); onOpened?.(); }
  }, [openId, rows]);

  const replace = row => { setData(list => list.map(x => (x.id === row.id ? row : x))); setView(v => (v?.row.id === row.id ? { ...v, row } : v)); };

  const copy = async r => {
    try { await navigator.clipboard.writeText(r.qr_payload); toast('نُسخت بيانات رمز الإجازة'); }
    catch { toast(r.short_code); }
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
                    {r.replaced_by_code && <span className="badge">صدر بدلها {r.replaced_by_code}</span>}
                    {r.replaces_code && <span className="badge badge-info">تصحيح لـ {r.replaces_code}</span>}
                    {r.pdf_sha256 && <span className="badge badge-success">PDF</span>}
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
                  <button className="icon-btn" onClick={() => setView({ row: r })} aria-label="عرض" title="عرض"><Icon name="eye" size={16} /></button>
                  <button className="icon-btn" onClick={() => setView({ row: r, print: true })} aria-label="طباعة" title="طباعة / PDF"><Icon name="print" size={16} /></button>
                  {r.revoked_at
                    ? <button className="icon-btn" onClick={() => restore(r)} aria-label="إعادة التفعيل" title="إعادة التفعيل"><Icon name="reset" size={16} /></button>
                    : <button className="icon-btn danger" onClick={() => setRevoking({ row: r, reason: '' })} aria-label="إلغاء الإجازة" title="إلغاء الإجازة"><Icon name="x" size={16} /></button>}
                  {!r.replaced_by_code && (
                    <button className="icon-btn" onClick={() => onCorrect?.(r)} aria-label="تصحيح" title="تصحيح: إصدار إجازة جديدة تحل محلها">
                      <Icon name="edit" size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && (
        <Modal title={`${view.row.student_name} — ${view.row.short_code}`} size="lg" onClose={() => setView(null)}>
          <ArchiveView row={view.row} settings={settings} profile={profile} onChanged={replace} autoPrint={view.print} />
        </Modal>
      )}

      {revoking && (
        <Modal title={`إلغاء إجازة «${revoking.row.student_name}»`} size="sm" onClose={() => setRevoking(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setRevoking(null)}>تراجع</button>
            <button className="btn btn-danger" onClick={revoke}>إلغاء الإجازة</button>
          </>}>
          <p className="muted small" style={{ marginBottom: 10 }}>
            تبقى في السجل، وعند التحقق من رمزها تظهر «ملغاة». يمكنك إعادة تفعيلها لاحقاً.
          </p>
          <label className="field">
            <span className="field-label">السبب (يظهر عند التحقق، اختياري)</span>
            <input className="input" value={revoking.reason} maxLength={255}
              onChange={e => setRevoking(v => ({ ...v, reason: e.target.value }))} placeholder="مثال: خطأ في اسم المجاز، صدرت بدلها إجازة جديدة" />
          </label>
        </Modal>
      )}
    </>
  );
}
