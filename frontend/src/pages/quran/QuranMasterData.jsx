import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';

// ✅ moved outside
const F = ({ label, field, type = 'text', form, setForm }) => (
  <div className="form-group"><label className="form-label">{label}</label>
    <input className="form-input" type={type} value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} /></div>
);

const SL = ({ label, field, opts, form, setForm }) => (
  <div className="form-group"><label className="form-label">{label}</label>
    <select className="form-select" value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}>
      <option value="">— غير محدد —</option>
      {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select></div>
);

export default function QuranMasterData() {
  const [tab, setTab] = useState('qiraat');
  const [qiraat, setQiraat] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [turuq, setTuruq] = useState([]);
  const [persons, setPersons] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [q, r, t, p] = await Promise.all([
      api.get('/quran/qiraat'), api.get('/quran/riwayat'),
      api.get('/quran/turuq'), api.get('/persons')
    ]);
    setQiraat(q.data); setRiwayat(r.data); setTuruq(t.data); setPersons(p.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      const { type, id, ...payload } = form;
      if (id) await api.put(`/quran/${type}/${id}`, payload);
      else await api.post(`/quran/${type}`, payload);
      load(); setModal(null);
    } finally { setLoading(false); }
  };

  const del = async (type, id) => {
    if (!confirm('حذف؟')) return;
    await api.delete(`/quran/${type}/${id}`); load();
  };

  const openAdd = (type) => { setForm({ type }); setModal('form'); };
  const openEdit = (type, item) => { setForm({ type, ...item }); setModal('form'); };

  return (
    <div>
      <div className="tabs">
        {[['qiraat','القراءات'],['riwayat','الروايات'],['turuq','الطرق']].map(([k,l]) => (
          <button key={k} className={`tab-btn ${tab===k?'active':''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'qiraat' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary" onClick={() => openAdd('qiraat')}>+ قراءة جديدة</button>
          </div>
          {qiraat.length === 0 ? <EmptyState icon="📖" title="لا توجد قراءات" /> : qiraat.map(q => (
            <div key={q.id} className="card"><div className="card-row">
              <div><div className="card-title">{q.name_ar}</div>
                <div className="card-sub">{q.imam_name && `الإمام: ${q.imam_name}`}</div></div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit('qiraat', q)}>تعديل</button>
                <button className="btn btn-danger btn-sm" onClick={() => del('qiraat', q.id)}>حذف</button>
              </div>
            </div></div>
          ))}
        </>
      )}

      {tab === 'riwayat' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary" onClick={() => openAdd('riwayat')}>+ رواية جديدة</button>
          </div>
          {riwayat.length === 0 ? <EmptyState icon="📜" title="لا توجد روايات" /> : riwayat.map(r => (
            <div key={r.id} className="card"><div className="card-row">
              <div><div className="card-title">{r.name_ar}</div>
                <div className="card-sub">{r.qiraa_name} {r.rawi_name && `· الراوي: ${r.rawi_name}`}</div></div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit('riwayat', r)}>تعديل</button>
                <button className="btn btn-danger btn-sm" onClick={() => del('riwayat', r.id)}>حذف</button>
              </div>
            </div></div>
          ))}
        </>
      )}

      {tab === 'turuq' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary" onClick={() => openAdd('turuq')}>+ طريق جديد</button>
          </div>
          {turuq.length === 0 ? <EmptyState icon="🔀" title="لا توجد طرق" /> : turuq.map(t => (
            <div key={t.id} className="card"><div className="card-row">
              <div><div className="card-title">{t.name_ar}</div>
                <div className="card-sub">{t.riwaya_name} {t.parent_name && `· من: ${t.parent_name}`}</div></div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit('turuq', t)}>تعديل</button>
                <button className="btn btn-danger btn-sm" onClick={() => del('turuq', t.id)}>حذف</button>
              </div>
            </div></div>
          ))}
        </>
      )}

      {modal === 'form' && (
        <Modal title={form.id ? '✏️ تعديل' : '➕ إضافة جديدة'} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'حفظ'}</button></>}>
          <F label="الاسم *" field="name_ar" form={form} setForm={setForm} />
          {form.type === 'qiraat' && <SL label="الإمام" field="imam_id" opts={persons.map(p => ({ id: p.id, label: p.name_ar }))} form={form} setForm={setForm} />}
          {form.type === 'riwayat' && <>
            <SL label="القراءة *" field="qiraa_id" opts={qiraat.map(q => ({ id: q.id, label: q.name_ar }))} form={form} setForm={setForm} />
            <SL label="الراوي" field="rawi_id" opts={persons.map(p => ({ id: p.id, label: p.name_ar }))} form={form} setForm={setForm} />
          </>}
          {form.type === 'turuq' && <>
            <SL label="الرواية" field="riwaya_id" opts={riwayat.map(r => ({ id: r.id, label: r.name_ar }))} form={form} setForm={setForm} />
            <SL label="الطريق الأصل" field="parent_id" opts={turuq.filter(t => t.id !== form.id).map(t => ({ id: t.id, label: t.name_ar }))} form={form} setForm={setForm} />
          </>}
          <div className="form-group"><label className="form-label">وصف</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </Modal>
      )}
    </div>
  );
}