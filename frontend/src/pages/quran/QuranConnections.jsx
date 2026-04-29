import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import Modal from '../../components/shared/Modal';
import EmptyState from '../../components/shared/EmptyState';
import AutocompleteSelect from '../../components/shared/AutoCompleteSelect';

const EMPTY_CONN = {
  from_person_id: '0', to_person_id: '',
  transmission_type_id: '', khatmat_count: 1,
  ijaza_date: '', meeting_mode: 'حضوراً',
  notes: '', description: '',
  items: [],  // [{qiraa_id, riwaya_id, tariq_id}]
};
const EMPTY_ITEM = { qiraa_id: '', riwaya_id: '', tariq_id: '' };

export default function QuranConnections() {
  const [conns, setConns]     = useState([]);
  const [persons, setPersons] = useState([]);
  const [qiraat, setQiraat]   = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [turuq, setTuruq]     = useState([]);
  const [txTypes, setTxTypes] = useState([]);
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY_CONN);
  const [loading, setLoading] = useState(false);
  const [filterQ, setFilterQ] = useState('');

  const load = async () => {
    const [c, p, q, r, t, tx] = await Promise.all([
      api.get('/quran-connections'), api.get('/persons'),
      api.get('/quran/qiraat'), api.get('/quran/riwayat'),
      api.get('/quran/turuq'), api.get('/tx-types?applies_to=quran')
    ]);
    setConns(c.data); setPersons(p.data); setQiraat(q.data);
    setRiwayat(r.data); setTuruq(t.data); setTxTypes(tx.data);
  };
  useEffect(() => { load(); }, []);

  // ── item helpers ──
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [field]: val };
    // cascade clear
    if (field === 'qiraa_id')  { items[i].riwaya_id = ''; items[i].tariq_id = ''; }
    if (field === 'riwaya_id') { items[i].tariq_id = ''; }
    return { ...f, items };
  });

  const filteredR = (qiraa_id) => riwayat.filter(r => !qiraa_id || String(r.qiraa_id) === qiraa_id);
  const filteredT = (riwaya_id) => turuq.filter(t => !riwaya_id || String(t.riwaya_id) === riwaya_id);

  // ── item label for display ──
  const itemLabel = (item) => {
    const q = qiraat.find(x => x.id === item.qiraa_id || String(x.id) === item.qiraa_id);
    const r = riwayat.find(x => x.id === item.riwaya_id || String(x.id) === item.riwaya_id);
    const t = turuq.find(x => x.id === item.tariq_id || String(x.id) === item.tariq_id);
    if (!q && !r && !t) return 'مطلق';
    return [q?.name_ar, r?.name_ar, t?.name_ar].filter(Boolean).join(' · ');
  };

  // ── connection scope summary for list ──
  const connScope = (c) => {
    if (!c.items || c.items.length === 0) return [{ label: 'مطلق', key: 'all' }];
    return c.items.map((it, i) => ({ label: itemLabel(it), key: i }));
  };

  // ── save ──
  const save = async () => {
    setLoading(true);
    try {
      const payload = {
        from_person_id:       parseInt(form.from_person_id) ?? 0,
        to_person_id:         parseInt(form.to_person_id),
        transmission_type_id: form.transmission_type_id || null,
        khatmat_count:        parseInt(form.khatmat_count) || 1,
        ijaza_date:           form.ijaza_date || null,
        meeting_mode:         form.meeting_mode || 'حضوراً',
        notes:                form.notes || null,
        description:          form.description || null,
        items: form.items
          .filter(it => it.qiraa_id || it.riwaya_id || it.tariq_id)
          .map(it => ({
            qiraa_id:  it.qiraa_id  || null,
            riwaya_id: it.riwaya_id || null,
            tariq_id:  it.tariq_id  || null,
          })),
      };
      if (modal === 'add') await api.post('/quran-connections', payload);
      else await api.put(`/quran-connections/${form.id}`, payload);
      load(); setModal(null);
    } finally { setLoading(false); }
  };

  const del = async id => { if (!confirm('حذف؟')) return; await api.delete(`/quran-connections/${id}`); load(); };

  const allP   = [{ id: 0, name_ar: 'أنا' }, ...persons];
  const pName  = id => id === 0 ? 'أنا' : (persons.find(p => p.id === id)?.name_ar || `#${id}`);

  // filter by qiraa: connection is visible if any item matches OR items empty (مطلق)
  const visibleConns = filterQ
    ? conns.filter(c => !c.items?.length || c.items.some(it => String(it.qiraa_id) === filterQ))
    : conns;

  const openAdd  = () => { setForm({ ...EMPTY_CONN, items: [] }); setModal('add'); };
  const openEdit = c => {
    setForm({
      ...EMPTY_CONN, ...c,
      from_person_id:       String(c.from_person_id),
      to_person_id:         String(c.to_person_id),
      transmission_type_id: c.transmission_type_id || '',
      khatmat_count:        c.khatmat_count ?? 1,
      ijaza_date:           c.ijaza_date    || '',
      meeting_mode:         c.meeting_mode  || 'حضوراً',
      notes:                c.notes         || '',
      items: (c.items || []).map(it => ({
        qiraa_id:  String(it.qiraa_id  || ''),
        riwaya_id: String(it.riwaya_id || ''),
        tariq_id:  String(it.tariq_id  || ''),
      })),
    });
    setModal('edit');
  };

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
        <select className="form-select" style={{ width: 200 }} value={filterQ} onChange={e => setFilterQ(e.target.value)}>
          <option value="">كل القراءات</option>
          {qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
        </select>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={openAdd}>+ اتصال قرآني</button>
      </div>

      {visibleConns.length === 0
        ? <EmptyState icon="🔗" title="لا توجد اتصالات قرآنية" subtitle="أضف أول اتصال" />
        : visibleConns.map(c => (
          <div key={c.id} className="conn-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 700 }}>{pName(c.from_person_id)}</span>
            <span className="conn-arrow">←</span>
            <span style={{ fontWeight: 700 }}>{c.to_name || `#${c.to_person_id}`}</span>

            {/* scope items */}
            <div style={{ flex: 1, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {connScope(c).map(s => (
                <span key={s.key} className={`badge ${s.label === 'مطلق' ? 'badge-gray' : 'badge-gold'}`}>{s.label}</span>
              ))}
              {c.tx_name       && <span className="badge badge-teal">{c.tx_name}</span>}
              {c.meeting_mode && c.meeting_mode !== 'حضوراً' && <span className="badge badge-gray">💻 {c.meeting_mode}</span>}
              {c.khatmat_count > 1 && <span className="badge badge-teal">🔁 {c.khatmat_count}</span>}
              {c.ijaza_date    && <span className="badge badge-purple">📅 {c.ijaza_date}</span>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>تعديل</button>
            <button className="btn btn-danger btn-sm" onClick={() => del(c.id)}>حذف</button>
          </div>
        ))
      }

      {modal && (
        <Modal title={modal === 'add' ? '📖 اتصال قرآني جديد' : '✏️ تعديل الاتصال'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'حفظ'}</button>
          </>}>

          {/* from / to */}
          <div className="form-row form-row-2">

            <SL label="من" field="from_person_id" opts={allP.map(p => ({ value: p.id, label: p.name_ar }))} opt0="اختر" />
            <SL label="أخذ عن" field="to_person_id" opts={persons.map(p => ({ value: p.id, label: p.name_ar }))} opt0="اختر" />
          </div>

          {/* scope items */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>ما قُرئ في هذا الاتصال</label>
              <button className="btn btn-ghost btn-sm" onClick={addItem}>+ إضافة رواية / قراءة</button>
            </div>

            {form.items.length === 0 && (
              <div className="hint">لا يوجد تحديد — الاتصال مطلق (يشمل كل ما قُرئ)</div>
            )}

            {form.items.map((item, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: 8, alignItems: 'end', marginBottom: 8,
                padding: '10px 12px', background: 'var(--surface-offset)',
                borderRadius: 'var(--radius)', border: '1px solid var(--border)'
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">القراءة</label>
                  <select className="form-select" value={item.qiraa_id}
                    onChange={e => updateItem(i, 'qiraa_id', e.target.value)}>
                    <option value="">— مطلق —</option>
                    {qiraat.map(q => <option key={q.id} value={q.id}>{q.name_ar}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">الرواية</label>
                  <select className="form-select" value={item.riwaya_id}
                    onChange={e => updateItem(i, 'riwaya_id', e.target.value)}>
                    <option value="">— مطلق —</option>
                    {filteredR(item.qiraa_id).map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">الطريق</label>
                  <select className="form-select" value={item.tariq_id}
                    onChange={e => updateItem(i, 'tariq_id', e.target.value)}>
                    <option value="">— مطلق —</option>
                    {filteredT(item.riwaya_id).map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
                  </select>
                </div>
                <button className="btn btn-danger btn-sm" style={{ height: 36 }} onClick={() => removeItem(i)}>✕</button>
              </div>
            ))}
          </div>

          {/* tx / meeting */}
          <div className="form-row form-row-2">
            <div className="form-group"><label className="form-label">طريقة التحمل</label>
              <select className="form-select" value={form.transmission_type_id}
                onChange={e => setForm(f => ({ ...f, transmission_type_id: e.target.value }))}>
                <option value="">—</option>
                {txTypes.map(t => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">الوسيلة</label>
              <select className="form-select" value={form.meeting_mode}
                onChange={e => setForm(f => ({ ...f, meeting_mode: e.target.value }))}>
                <option>حضوراً</option><option>عن بُعد</option><option>مختلط</option>
              </select></div>
          </div>

          {/* khatmat / ijaza */}
          <div className="form-row form-row-2">
            <div className="form-group"><label className="form-label">عدد الختمات</label>
              <input className="form-input" type="number" value={form.khatmat_count}
                onChange={e => setForm(f => ({ ...f, khatmat_count: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">تاريخ الإجازة (هجري)</label>
              <input className="form-input" value={form.ijaza_date} placeholder="مثال: 1444هـ"
                onChange={e => setForm(f => ({ ...f, ijaza_date: e.target.value }))} /></div>
          </div>

          <div className="form-group"><label className="form-label">ملاحظات التلاوة</label>
            <textarea className="form-textarea" rows={2} value={form.notes || ''}
              placeholder="مثال: أجازني بالغنة والتحقيق فقط..."
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">وصف عام</label>
            <textarea className="form-textarea" rows={2} value={form.description || ''}
              placeholder="مثال: ختمت عليه في رمضان 1444هـ بمنزله..."
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </Modal>
      )}
    </div>
  );
}
