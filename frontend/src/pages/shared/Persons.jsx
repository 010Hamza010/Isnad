import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';

const EMPTY = { name_ar: '', name_latin: '', kunya: '', nisba: '', century: '', death_year: '', region: '', description: '', primary_qiraa_id: '' };

// ── moved OUTSIDE — no re-creation on parent render ──
const F = ({ label, field, type = 'text', placeholder = '', form, setForm }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    {type === 'textarea'
      ? <textarea className="form-textarea" value={form[field] || ''} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
      : <input className="form-input" type={type} value={form[field] || ''} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />}
  </div>
);

export default function Persons() {
  const [persons, setPersons] = useState([]);
  const [qiraat, setQiraat]   = useState([]);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = async () => { const { data } = await api.get(`/persons?q=${search}`); setPersons(data); };
  useEffect(() => { load(); }, [search]);
  useEffect(() => { api.get('/quran/qiraat').then(r => setQiraat(r.data)); }, []);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = p  => { setForm({ ...p, century: p.century || '', death_year: p.death_year || '', primary_qiraa_id: p.primary_qiraa_id || '' }); setModal('edit'); };

  const save = async () => {
    setLoading(true);
    try {
      if (modal === 'add') await api.post('/persons', form);
      else await api.put(`/persons/${form.id}`, form);
      setModal(null); load();
    } finally { setLoading(false); }
  };

  const del = async id => {
    if (!confirm('حذف هذا الشخص؟')) return;
    await api.delete(`/persons/${id}`); load();
  };

  const filtered = persons.filter(p => !search || p.name_ar.includes(search) || (p.name_latin || '').toLowerCase().includes(search.toLowerCase()));
  const qiraaName = id => qiraat.find(q => Number(q.id) === Number(id))?.name_ar;

  // shorthand to avoid repeating form/setForm on every field
  const ff = { form, setForm };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input className="form-input" style={{ flex: 1 }} placeholder="بحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openAdd}>+ شخص جديد</button>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="👤" title="لا يوجد أشخاص" subtitle="أضف أول شخص لتبدأ" action={<button className="btn btn-primary" onClick={openAdd}>+ إضافة</button>} />
        : filtered.map(p => (
          <div key={p.id} className="card">
            <div className="card-row">
              <div>
                <div className="card-title">
                  {p.name_ar} {p.kunya && <span className="text-muted" style={{fontWeight:400}}>({p.kunya})</span>}
                  {p.primary_qiraa_id && (
                    <span className="badge badge-teal" style={{ marginRight: 8, fontSize: 11 }}>
                      {qiraaName(p.primary_qiraa_id)}
                    </span>
                  )}
                </div>
                <div className="card-sub">
                  {p.region && <span>{p.region} · </span>}
                  {p.death_year && <span>ت {p.death_year}هـ · </span>}
                  {p.name_latin && <span>{p.name_latin}</span>}
                </div>
                {p.description && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, maxWidth: 500 }}>{p.description.substring(0, 100)}{p.description.length > 100 ? '...' : ''}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>تعديل</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>حذف</button>
              </div>
            </div>
          </div>
        ))
      }

      {modal && (
        <Modal title={modal === 'add' ? '👤 شخص جديد' : '✏️ تعديل الشخص'} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'حفظ'}</button></>}>

          <F label="الاسم بالعربية *" field="name_ar" placeholder="مثال: الشيخ محمد بن أحمد..." {...ff} />
          <div className="form-row form-row-2">
            <F label="الكنية" field="kunya" placeholder="أبو عبد الله..." {...ff} />
            <F label="النسبة" field="nisba" placeholder="المالكي، الجزائري..." {...ff} />
          </div>
          <div className="form-row form-row-2">
            <F label="القرن" field="century" type="number" placeholder="مثال: 9" {...ff} />
            <F label="سنة الوفاة" field="death_year" placeholder="مثال: 852هـ" {...ff} />
          </div>
          <div className="form-row form-row-2">
            <F label="المنطقة" field="region" placeholder="المغرب، الجزائر..." {...ff} />
            <F label="الاسم اللاتيني" field="name_latin" placeholder="Ibn Hajar..." {...ff} />
          </div>

          <div className="form-group">
            <label className="form-label">القراءة الرئيسية <span style={{color:'var(--muted)', fontWeight:400}}>(للأئمة فقط)</span></label>
            <select className="form-select" value={form.primary_qiraa_id || ''}
              onChange={e => setForm(f => ({ ...f, primary_qiraa_id: e.target.value || null }))}>
              <option value="">— لا تخصص —</option>
              {qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
            </select>
          </div>

          <F label="ترجمة وملاحظات" field="description" type="textarea" placeholder="ترجمة مختصرة، إجازات، روايات..." {...ff} />
        </Modal>
      )}
    </div>
  );
}