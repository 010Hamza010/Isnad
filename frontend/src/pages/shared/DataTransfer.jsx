import React, { useRef, useState } from 'react';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import Icon from '../../components/ui/Icon';
import { downloadFrom, readJsonFile } from '../../utils/download';
import ShareIsnad from './ShareIsnad';
import Thabat from './Thabat';

// the tables people recognise; the others are counted under «أخرى»
const LABELS = {
  persons: 'الأعلام', mutoon: 'المتون', matn_connections: 'اتصالات المتون', quran_connections: 'اتصالات القرآن',
  qiraat: 'القراءات', riwayat: 'الروايات', turuq: 'الطرق', ijazat: 'الإجازات', ijaza_files: 'ملفات الإجازات',
};
const fmt = n => Number(n || 0).toLocaleString('ar');

function Counts({ counts }) {
  const other = Object.entries(counts).filter(([t]) => !LABELS[t]).reduce((s, [, n]) => s + n, 0);
  return (
    <div className="chips">
      {Object.entries(LABELS).filter(([t]) => t in counts).map(([t, l]) => <span key={t} className="badge">{l} {fmt(counts[t])}</span>)}
      {other > 0 && <span className="badge">أخرى {fmt(other)}</span>}
    </div>
  );
}

/** Settings tab: full backup (download / restore) and sharing one isnad with another instance. */
export default function DataTransfer() {
  const { toast, notifyError, confirm } = useUI();
  const { data: summary, reload } = useLoad(() => api.get('/data/summary').then(r => r.data), [], null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef(null);

  const download = async () => {
    setBusy('down');
    try { await downloadFrom('/data/backup', 'isnad-backup.json'); toast('نُزّلت النسخة الاحتياطية'); }
    catch (e) { notifyError(e); } finally { setBusy(''); }
  };

  const restore = async file => {
    const data = await readJsonFile(file);
    if (data?.format !== 'isnad-backup' || !data.tables) { toast('هذا الملف ليس نسخة احتياطية من «إسناد»', 'error'); return; }
    const counts = Object.fromEntries(Object.entries(data.tables).map(([t, rows]) => [t, rows.length]));
    const line = c => Object.entries(LABELS).filter(([t]) => t in c).map(([t, l]) => `${l} ${fmt(c[t])}`).join(' · ');
    const ok = await confirm({
      title: 'استعادة نسخة احتياطية', danger: true, confirmLabel: 'استبدال كل البيانات',
      message: `ستُستبدل كل بياناتك الحالية (${line(summary?.counts || {})}) ببيانات النسخة المؤرخة ${new Date(data.created_at).toLocaleString('ar')}: ${line(counts)}. حسابك وكلمة مرورك لا يتغيّران، وتُحفظ نسخة من الحالية تلقائياً.`,
    });
    if (!ok) return;
    setBusy('up');
    try {
      await api.post('/data/restore', data, { timeout: 0 });
      toast('تمت الاستعادة');
      setTimeout(() => window.location.reload(), 600); // every page shows the restored data
    } catch (e) { notifyError(e); setBusy(''); }
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <section className="card settings-section">
        <div className="card-head"><Icon name="save" /><div className="card-title">نسخة احتياطية كاملة</div><span className="muted">كل البيانات في ملف واحد</span></div>
        <div className="card-pad stack">
          {summary ? <Counts counts={summary.counts} /> : <div className="skeleton" style={{ height: 26 }} />}
          <div className="row row-wrap" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={download} disabled={!!busy}>
              {busy === 'down' ? <span className="spinner" /> : <><Icon name="arrow" size={14} /> تنزيل نسخة احتياطية</>}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              {busy === 'up' ? <span className="spinner" /> : <><Icon name="reset" size={14} /> استعادة من نسخة…</>}
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restore(f); }} />
            {summary?.preRestore && (
              <button className="btn btn-ghost btn-sm" disabled={!!busy}
                onClick={() => downloadFrom('/data/backup/pre-restore', 'isnad-before-restore.json').catch(notifyError)}>
                تنزيل البيانات كما كانت قبل آخر استعادة
              </button>
            )}
          </div>
          <div className="small muted">
            لا يتضمن الملف اسم المستخدم ولا كلمة المرور. رموز QR في الإجازات الصادرة تبقى صالحة بعد النقل إلى خادم آخر
            إذا كان له نفس <code>QR_SECRET</code> (أو <code>JWT_SECRET</code>).
          </div>
        </div>
      </section>

    </div>
  );
}
