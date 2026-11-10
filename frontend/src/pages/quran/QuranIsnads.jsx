import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import IsnadGroups from '../../components/isnad/IsnadGroups';
import EmptyState from '../../components/ui/EmptyState';
import { countLabel } from '../../utils/text';
import { quranOptions, quranPathParams } from '../../utils/quranOptions';

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

  const options = useMemo(() => quranOptions(conns, { qiraat, riwayat, turuq }), [conns, qiraat, riwayat, turuq]);

  // quiet: reload in place (after a route is switched off/on) without the skeleton
  const load = async (opt, { quiet = false } = {}) => {
    setSelected(opt);
    if (!quiet) setLoading(true);
    try {
      const { data } = await api.get(`/graph/quran/paths?${quranPathParams(opt)}`);
      setResult(data);
    } catch (e) { notifyError(e); if (!quiet) setResult(null); }
    finally { if (!quiet) setLoading(false); }
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

            {paths.length === 0 && !result.disabled?.length && (
              <div className="card"><EmptyState icon="alert" title="لا يوجد سند متصل"
                subtitle="السلسلة لم تصل إلى إمام القراءة بعد — أكمل الحلقات الناقصة"
                action={<Link to="/quran/connections" className="btn btn-secondary">إدارة الاتصالات</Link>} /></div>
            )}

            <IsnadGroups key={result.scope} paths={paths} disabled={result.disabled} scope={result.scope} endIds={[imamId]} scopeOf={scopeOf}
              via="قرأتُ على" onChanged={() => load(selected, { quiet: true })} />
          </>
        )}
      </section>
    </div>
  );
}
