import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';

const SUBJECTS = ['فقه','نحو','تجويد', "قراءات", 'عقيدة','حديث','تفسير','أصول','بلاغة','سيرة','أخرى'];
const EMPTY = { title: '', author_id: '', subject: '', description: '' };

const F = ({ label, field, type = 'text', form, setForm }) => (
  <div className="form-group"><label className="form-label">{label}</label>
    <input className="form-input" type={type} value={form[field] || ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} /></div>
);

const MCard = ({ m, onEdit, onDel }) => (
  <div className="card">
    <div className="card-row">
      <div>
        <div className="card-title">{m.title}</div>
        <div className="card-sub">{m.author_name && `المؤلف: ${m.author_name}`}</div>
        {m.description && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{m.description.substring(0, 80)}{m.description.length > 80 ? '...' : ''}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {m.subject && <span className="badge badge-gray">{m.subject}</span>}
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>تعديل</button>
        <button className="btn btn-danger btn-sm" onClick={() => onDel(m.id)}>حذف</button>
      </div>
    </div>
  </div>
);

export default function MatnList() {
  const [mutoon, setMutoon] = useState([]);
  const [persons, setPersons] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/mutoon').then(r => setMutoon(r.data));
    api.get('/persons').then(r => setPersons(r.data));
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      if (modal === 'add') await api.post('/mutoon', form);
      else await api.put(`/mutoon/${form.id}`, form);
      const { data } = await api.get('/mutoon');
      setMutoon(data); setModal(null);
    } finally { setLoading(false); }
  };

  const del = async id => {
    if (!confirm('حذف هذا المتن؟')) return;
    await api.delete(`/mutoon/${id}`);
    setMutoon(m => m.filter(x => x.id !== id));
  };

  const handleEdit = m => { setForm({ ...m, author_id: m.author_id || '' }); setModal('edit'); };

  const grouped = SUBJECTS.reduce((acc, s) => {
    const items = mutoon.filter(m => m.subject === s && (!filter || m.subject === filter));
    if (items.length) acc[s] = items;
    return acc;
  }, {});
  const other = mutoon.filter(m => !SUBJECTS.includes(m.subject) && (!filter || m.subject === filter));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select className="form-select" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">كل الموضوعات</option>
          {SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={() => { setForm(EMPTY); setModal('add'); }}>+ متن جديد</button>
      </div>

      {mutoon.length === 0
        ? <EmptyState icon="📚" title="لا توجد متون" subtitle="أضف أول متن" action={<button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal('add'); }}>+ إضافة</button>} />
        : <>
          {Object.entries(grouped).map(([subj, items]) => (
            <div key={subj}>
              <div className="section-title" style={{ borderBottom: '2px solid var(--primary-highlight)', paddingBottom: 6, marginBottom: 10 }}>{subj}</div>
              {items.map(m => <MCard key={m.id} m={m} onEdit={handleEdit} onDel={del} />)}
            </div>
          ))}
          {other.map(m => <MCard key={m.id} m={m} onEdit={handleEdit} onDel={del} />)}
        </>
      }

      {modal && (
        <Modal title={modal === 'add' ? '📗 متن جديد' : '✏️ تعديل المتن'} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'حفظ'}</button></>}>
          <F label="عنوان المتن *" field="title" form={form} setForm={setForm} />
          <div className="form-group"><label className="form-label">المؤلف</label>
            <select className="form-select" value={form.author_id || ''} onChange={e => setForm(f => ({ ...f, author_id: e.target.value }))}>
              <option value="">— غير محدد —</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">الموضوع</label>
            <select className="form-select" value={form.subject || ''} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
              <option value="">— اختر —</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">وصف</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </Modal>
      )}
    </div>
  );
}