import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import ChainView from '../../components/isnad/ChainView';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import { isMe, countLabel } from '../../utils/text';

const PATH_FORMS = ['سند واحد', 'سندان', 'أسانيد', 'سنداً'];

export default function QuranIsnads() {
  const { notifyError } = useUI();
  const { data, loading: listLoading } = useLoad(async () => {
    const [c, q, r, t] = await Promise.all([
      api.get('/quran-connections'), api.get('/quran/qiraat'),
      api.get('/quran/riwayat'), api.get('/quran/turuq'),
    ]);
    return { conns: c.data, qiraat: q.data, riwayat: r.data, turuq: t.data };
  }, [], { conns: [], qiraat: [], riwayat: [], turuq: [] });
  const { conns, qiraat, riwayat, turuq } = data;

  const [selected, setSelected] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const qMap = useMemo(() => new Map(qiraat.map(q => [Number(q.id), q])), [qiraat]);
  const rMap = useMemo(() => new Map(riwayat.map(r => [Number(r.id), r])), [riwayat]);
  const tMap = useMemo(() => new Map(turuq.map(t => [Number(t.id), t])), [turuq]);

  // Every distinct (qiraa, riwaya, tariq) I hold directly from one of my shuyukh
  const options = useMemo(() => {
    const seen = new Map();
    conns.filter(c => isMe(c.from_person_id)).forEach(conn => {
      const items = conn.items?.length ? conn.items : [{}];
      items.forEach(it => {
        const riwaya   = it.riwaya_id ? rMap.get(Number(it.riwaya_id)) : null;
        const qiraa_id = riwaya?.qiraa_id || it.qiraa_id || null;
        const key = `q${qiraa_id}-r${it.riwaya_id || null}-t${it.tariq_id || null}`;
        if (!seen.has(key)) seen.set(key, {
          key, qiraa_id, riwaya_id: it.riwaya_id || null, tariq_id: it.tariq_id || null,
          qiraaLabel:  qiraa_id ? qMap.get(Number(qiraa_id))?.name_ar : 'مطلق',
          riwayaLabel: riwaya?.name_ar || null,
          tariqLabel:  it.tariq_id ? tMap.get(Number(it.tariq_id))?.name_ar : null,
          teachers: [],
        });
        const opt = seen.get(key);
        if (!opt.teachers.includes(conn.to_name)) opt.teachers.push(conn.to_name);
      });
    });
    const grouped = new Map();
    seen.forEach(o => { if (!grouped.has(o.qiraaLabel)) grouped.set(o.qiraaLabel, []); grouped.get(o.qiraaLabel).push(o); });
    return [...grouped.entries()];
  }, [conns, qMap, rMap, tMap]);

  const load = async opt => {
    setSelected(opt); setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opt.riwaya_id) params.append('riwaya_id', opt.riwaya_id);
      if (opt.tariq_id)  params.append('tariq_id', opt.tariq_id);
      if (!opt.riwaya_id && opt.qiraa_id) params.append('qiraa_id', opt.qiraa_id);
      const { data } = await api.get(`/graph/quran/paths?${params}`);
      setResult(data);
    } catch (e) { notifyError(e); setResult(null); }
    finally { setLoading(false); }
  };

  const scopeOf = edge => {
    if (!edge.items?.length) return null;
    return edge.items.map(it => {
      const r = it.riwaya_id ? rMap.get(Number(it.riwaya_id)) : null;
      const q = qMap.get(Number(r?.qiraa_id || it.qiraa_id));
      const t = it.tariq_id ? tMap.get(Number(it.tariq_id)) : null;
      return [q?.name_ar, r?.name_ar, t?.name_ar].filter(Boolean).join(' · ');
    }).filter(Boolean).join('، ') || null;
  };

  const paths = result?.paths || [];
  const riwaya = result?.riwaya;
  const imamId = riwaya?.imam_id || (selected?.qiraa_id && qMap.get(Number(selected.qiraa_id))?.imam_id);

  return (
    <div className="split">
      <aside className="card split-side">
        <div className="card-head"><div className="card-title">قراءاتي ورواياتي</div></div>
        <div className="side-list">
          {listLoading && !conns.length && [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, margin: 6 }} />)}
          {!listLoading && options.length === 0 && (
            <div className="small muted" style={{ padding: 16, textAlign: 'center' }}>
              لم تسجّل بعدُ قراءةً على شيخ. <Link to="/quran/connections">أضف اتصالاً</Link>
            </div>
          )}
          {options.map(([label, opts]) => (
            <div key={label}>
              <div className="side-group">{label}</div>
              {opts.map(o => (
                <button key={o.key} className={`side-item${selected?.key === o.key ? ' active' : ''}`} onClick={() => load(o)}>
                  <span className="t">{o.riwayaLabel || (o.qiraa_id ? 'كل الروايات' : 'إجازة مطلقة')}</span>
                  {o.tariqLabel && <span className="s">طريق {o.tariqLabel}</span>}
                  <span className="s">عن {o.teachers.join('، ')}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <section>
        {!selected && <div className="card"><EmptyState icon="quran" title="اختر رواية" subtitle="سيظهر سندك متصلاً إلى النبي ﷺ عن جبريل عن رب العزة" /></div>}

        {selected && loading && <div className="stack"><div className="skeleton" style={{ height: 110 }} /><div className="skeleton" style={{ height: 300 }} /></div>}

        {selected && !loading && result && (
          <>
            <div className="hero">
              <div className="row row-wrap">
                <div className="spacer">
                  <div className="hero-title">{selected.riwayaLabel || selected.qiraaLabel}</div>
                  <div className="hero-sub">
                    {[
                      riwaya?.qiraa_name || (selected.riwayaLabel ? null : selected.qiraa_id && selected.qiraaLabel),
                      riwaya?.imam_name && `الإمام ${riwaya.imam_name}`,
                      riwaya?.rawi_name && `الراوي ${riwaya.rawi_name}`,
                      selected.tariqLabel && `طريق ${selected.tariqLabel}`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="badge">{countLabel(paths.length, PATH_FORMS)}</span>
              </div>
            </div>

            {paths.length === 0 && (
              <div className="card"><EmptyState icon="alert" title="لا يوجد سند متصل"
                subtitle="السلسلة لم تصل إلى إمام القراءة بعد — أكمل الحلقات الناقصة"
                action={<Link to="/quran/connections" className="btn btn-secondary">إدارة الاتصالات</Link>} /></div>
            )}

            {paths.map((g, i) => (
              <div key={i} className="card chain-card">
                <div className="card-head">
                  <span className="badge badge-primary">{i + 1}</span>
                  <span className="via">قرأتُ على</span>
                  <span className="strong">{g.firstEdge.to_name}</span>
                  {g.chains.length > 1 && <span className="badge" style={{ marginInlineStart: 'auto' }}>{g.chains.length} طرق</span>}
                </div>
                <ChainView firstEdge={g.firstEdge} chains={g.chains} endIds={[imamId]} scopeOf={scopeOf} />
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
