import React, { useEffect, useState, useRef } from 'react';
import api from '../../utils/api';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';
import AutocompleteSelect from '../../components/shared/AutoCompleteSelect';

const EMPTY = { from_person_id: '0', to_person_id: '', matn_id: '', transmission_type_id: '', is_general_ijaza: false, description: '' };

export default function MatnConnections() {
  const [conns, setConns] = useState([]);
  const [persons, setPersons] = useState([]);
  const [mutoon, setMutoon] = useState([]);
  const [txTypes, setTxTypes] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [filterMatn, setFilterMatn] = useState('');

  const load = async () => {
    const [c, p, m, t] = await Promise.all([
      api.get('/matn-connections'), api.get('/persons'),
      api.get('/mutoon'), api.get('/tx-types?applies_to=mutoon')
    ]);
    setConns(c.data); setPersons(p.data); setMutoon(m.data); setTxTypes(t.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setLoading(true);
    try {
      const payload = { ...form, from_person_id: parseInt(form.from_person_id) || 0, to_person_id: parseInt(form.to_person_id), matn_id: form.matn_id || null, transmission_type_id: form.transmission_type_id || null };
      if (modal === 'add') await api.post('/matn-connections', payload);
      else await api.put(`/matn-connections/${form.id}`, payload);
      load(); setModal(null);
    } finally { setLoading(false); }
  };

  const del = async id => { if (!confirm('حذف؟')) return; await api.delete(`/matn-connections/${id}`); load(); };

  const allP = [{ id: 0, name_ar: 'أنا' }, ...persons];
  const pName = id => id === 0 ? 'أنا' : (persons.find(p => p.id === id)?.name_ar || `#${id}`);
  const filtered = filterMatn ? conns.filter(c => String(c.matn_id) === filterMatn) : conns;

  const SL = ({ label, field, opts, opt0 = '—', onCh }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <AutocompleteSelect
        value={form[field] || ''}
        opts={opts}
        placeholder={opt0}
        onChange={val => {
          setForm(f => ({ ...f, [field]: val }));
          onCh && onCh(val);
        }}
      />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select className="form-select" style={{ width: 200 }} value={filterMatn} onChange={e => setFilterMatn(e.target.value)}>
          <option value="">كل المتون</option>
          {mutoon.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={() => { setForm(EMPTY); setModal('add'); }}>+ اتصال جديد</button>
      </div>

      {filtered.length === 0
        ? <EmptyState icon="🔗" title="لا توجد اتصالات" subtitle="أضف أول اتصال بين شخصين" />
        : filtered.map(c => (
          <div key={c.id} className="conn-row">
            <span style={{ fontWeight: 700 }}>{pName(c.from_person_id)}</span>
            <span className="conn-arrow">←</span>
            <span style={{ fontWeight: 700 }}>{c.to_name || `#${c.to_person_id}`}</span>
            <div className="tag-row" style={{ flex: 1 }}>
              {c.tx_name && <span className="badge badge-teal">{c.tx_name}</span>}
              {c.matn_title && <span className="badge badge-gray">{c.matn_title}</span>}
              {c.is_general_ijaza ? <span className="badge badge-gold">إجازة عامة</span> : null}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...c, from_person_id: String(c.from_person_id), to_person_id: String(c.to_person_id), matn_id: c.matn_id || '', transmission_type_id: c.transmission_type_id || '' }); setModal('edit'); }}>تعديل</button>
            <button className="btn btn-danger btn-sm" onClick={() => del(c.id)}>حذف</button>
          </div>
        ))
      }

      {modal && (
        <Modal title={modal === 'add' ? '+ اتصال جديد' : '✏️ تعديل الاتصال'} onClose={() => setModal(null)}
          footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'حفظ'}</button></>}>
          <div className="hint">أدخل من أخذ عن من — المسارات تُبنى تلقائياً</div>
          <div className="form-row form-row-2">
            <SL label="من" field="from_person_id" opts={allP.map(p => ({ value: p.id, label: p.name_ar }))} opt0="اختر" />
            <SL label="أخذ عن" field="to_person_id" opts={persons.map(p => ({ value: p.id, label: p.name_ar }))} opt0="اختر" />
          </div>
          <SL label="المتن (اتركه فارغاً للإجازة العامة)" field="matn_id" opts={mutoon.map(m => ({ value: m.id, label: m.title }))} />
          <SL label="طريقة التحمل" field="transmission_type_id" opts={txTypes.map(t => ({ value: t.id, label: t.name_ar }))} />
          <div className="form-group">
            <label className="form-check">
              <input type="checkbox" checked={!!form.is_general_ijaza} onChange={e => setForm(f => ({ ...f, is_general_ijaza: e.target.checked }))} />
              إجازة عامة (تشمل جميع المتون)
            </label>
          </div>
          <div className="form-group"><label className="form-label">وصف / ملاحظة</label>
            <textarea className="form-textarea" value={form.description || ''} placeholder="مثال: قرأت عليه المتن كاملاً في بيته..." onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </Modal>
      )}
    </div>
  );
}
