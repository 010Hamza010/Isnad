import React, { useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import Modal from '../../components/ui/Modal';
import EmptyState, { SkeletonList } from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Icon from '../../components/ui/Icon';
import Certificate from '../../components/ijaza/Certificate';
import { matches } from '../../utils/text';

const MODULE_BADGE = { mutoon: ['متن', 'badge-info'], quran: ['قرآن', 'badge-accent'], general: ['عامة', 'badge-purple'] };

export default function IjazaRegister() {
  const { toast, notifyError, confirm } = useUI();
  const { data: rows, loading, reload } = useLoad(() => api.get('/ijazat').then(r => r.data), [], []);
  const [search, setSearch] = useState('');
  const [view, setView] = useState(null);

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
                  </div>
                  <div className="list-sub">{[r.title, r.issued_hijri || String(r.issued_at).slice(0, 10), r.place].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setView(r)} aria-label="عرض"><Icon name="eye" size={16} /></button>
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
            notes={view.details?.notes || {}} chains={view.details?.chains || []} />
        </Modal>
      )}
    </>
  );
}
