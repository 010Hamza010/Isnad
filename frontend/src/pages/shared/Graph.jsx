import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import Segmented from '../../components/ui/Segmented';
import Combobox from '../../components/ui/Combobox';
import Icon from '../../components/ui/Icon';
import { routeGraph, stepsFromMe, numbered } from '../../utils/routeGraph';

const SACRED = { [-1]: 'النبي ﷺ', [-2]: 'جبريل عليه السلام', [-3]: 'رب العزة' };
const ROUTE_ORDER = () => { try { return localStorage.getItem('isnad.routeOrder') || 'high'; } catch { return 'high'; } };

// read design tokens so the graph follows light/dark theme
const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// a matn connection with no matn of its own (valid for every matn): its scope, not how it was received
const isGeneral = e => !!Number(e.is_general_ijaza) || !e.matn_title;
const routesText = rs => (rs.length <= 3 ? rs.join('، ') : `${rs.length} طرق`);

export default function Graph() {
  const { toast, notifyError } = useUI();
  const containerRef = useRef(null);
  const networkRef   = useRef(null);
  const [mod, setMod]     = useState('both');
  const [focus, setFocus] = useState('');
  const [matnId, setMatnId] = useState('');          // limit the graph to the routes of one matn
  const [hideGeneral, setHideGeneral] = useState(false);
  const [showOff, setShowOff] = useState(false);
  const [route, setRoute] = useState(null);          // selected route label «g.r»
  const [busy, setBusy] = useState(false);
  const { data, loading } = useLoad(() => api.get(`/graph/full?module=${mod}`).then(r => r.data), [mod]);
  const { data: mutoon } = useLoad(() => api.get('/mutoon?connected=1').then(r => r.data), [], []);
  const { data: matnPaths, loading: pathsLoading, reload: reloadPaths } = useLoad(
    () => (matnId ? api.get(`/graph/matn/${matnId}/paths`).then(r => r.data) : Promise.resolve(null)), [matnId]);

  const byMatn = mod !== 'quran' && matnId && matnPaths;
  const rg = useMemo(() => (byMatn ? routeGraph(matnPaths.paths, matnPaths.disabled, ROUTE_ORDER()) : null), [byMatn, matnPaths]);

  const nodeOpts = useMemo(() => {
    if (rg) return [...rg.names].filter(([id]) => id > 0).map(([id, name]) => ({ value: id, label: name }));
    if (!data) return [];
    const used = new Set([...data.matnEdges, ...data.quranEdges].flatMap(e => [e.from_person_id, e.to_person_id]));
    return data.persons.filter(p => used.has(p.id)).map(p => ({ value: p.id, label: p.name_ar }));
  }, [data, rg]);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    networkRef.current?.destroy();

    const c = {
      primary: token('--primary'), primarySoft: token('--primary-soft'),
      accent: token('--accent'), accentSoft: token('--accent-soft'),
      text: token('--text'), muted: token('--muted'), faint: token('--faint'), surface: token('--surface'), border: token('--border-strong'),
      purple: token('--purple'), info: token('--info'),
    };
    const txColor = name => ({ 'سماع': c.primary, 'قراءة على الشيخ': c.primary, 'إجازة': c.purple, 'إجازة عامة': c.accent, 'عرض': c.info }[name] || c.muted);
    const font = { face: 'IBM Plex Sans Arabic, sans-serif', size: 14, color: c.text };
    const box = (id, label, quranOnly = false, extra = {}) => ({
      id, label, shape: 'box', margin: 8,
      color: { background: quranOnly ? c.accentSoft : c.primarySoft, border: quranOnly ? c.accent : c.primary,
               highlight: { background: c.surface, border: c.text } },
      font: { ...font, color: quranOnly ? c.accent : c.primary }, ...extra,
    });
    const meNode = { id: 0, label: 'أنا', shape: 'circle', color: { background: c.primary, border: c.primary }, font: { ...font, color: c.surface, size: 16, bold: true }, margin: 14 };

    const nodes = new Map([[0, meNode]]);
    let edges;
    if (rg) {
      // one matn: only the persons on its routes, each with its order(s); links carry their route numbers
      const offOnly = new Set(rg.edges.filter(e => e.off).flatMap(e => [e.from, e.to]));
      rg.edges.filter(e => !e.off).forEach(e => { offOnly.delete(e.from); offOnly.delete(e.to); });
      rg.names.forEach((name, id) => {
        if (id === 0 || (!showOff && offOnly.has(id))) return;
        nodes.set(id, box(id, numbered(name, rg.depths.get(id)), false, offOnly.has(id) ? { color: { background: c.surface, border: c.border }, font: { ...font, color: c.faint } } : {}));
      });
      edges = rg.edges.filter(e => showOff || !e.off).map(e => ({
        id: `${e.from}>${e.to}`, from: e.from, to: e.to, dashes: e.off,
        label: e.off ? 'معطّل' : routesText(e.routes), font: { ...font, size: 11, color: c.muted, strokeWidth: 3, strokeColor: c.surface },
        color: { color: e.off ? c.border : txColor(e.tx), opacity: e.off ? .6 : .85 }, width: e.off ? 1 : 1 + Math.min(e.routes.length, 6) * .4,
        title: e.off ? 'طريق معطّل' : [`الطرق: ${e.routes.join('، ')}`, e.tx].filter(Boolean).join(' · '),
      }));
    } else {
      const matnEdges = hideGeneral ? data.matnEdges.filter(e => !isGeneral(e)) : data.matnEdges;
      const quranIds = new Set(data.quranEdges.flatMap(e => [e.from_person_id, e.to_person_id]));
      const matnIds  = new Set(matnEdges.flatMap(e => [e.from_person_id, e.to_person_id]));
      const steps = stepsFromMe([...matnEdges, ...data.quranEdges].map(e => ({ from: Number(e.from_person_id), to: Number(e.to_person_id) })));
      Object.entries(SACRED).forEach(([id, label]) => {
        if (quranIds.has(Number(id))) nodes.set(Number(id), { id: Number(id), label, shape: 'box', color: { background: c.accentSoft, border: c.accent }, font: { ...font, color: c.accent, size: 15 }, margin: 10 });
      });
      data.persons.forEach(p => {
        if (!quranIds.has(p.id) && !matnIds.has(p.id)) return; // only people in the network
        const s = steps.get(p.id);
        nodes.set(p.id, box(p.id, numbered(p.name_ar, s ? [s] : null), quranIds.has(p.id) && !matnIds.has(p.id),
          { title: p.name_ar + (p.region ? ` · ${p.region}` : '') + (s ? ` · الترتيب ${s}` : '') }));
      });
      let eid = 1;
      edges = [
        ...matnEdges.map(e => ({ id: eid++, from: e.from_person_id, to: e.to_person_id, dashes: isGeneral(e),
          color: { color: txColor(e.tx_name), opacity: .8 }, title: [e.tx_name, e.matn_title || 'بلا متن محدد'].filter(Boolean).join(' · ') })),
        ...data.quranEdges.map(e => ({ id: eid++, from: e.from_person_id, to: e.to_person_id, width: 2,
          color: { color: e.tx_name ? txColor(e.tx_name) : c.accent, opacity: .8 }, title: e.tx_name || undefined })),
      ];
    }
    edges = edges.filter(e => nodes.has(e.from) && nodes.has(e.to));

    networkRef.current = new Network(containerRef.current, { nodes: new DataSet([...nodes.values()]), edges: new DataSet(edges) }, {
      layout: { hierarchical: { enabled: true, direction: 'UD', sortMethod: 'directed', levelSeparation: 110, nodeSpacing: 170 } },
      physics: false,
      interaction: { hover: true, navigationButtons: false, keyboard: true, tooltipDelay: 150 },
      edges: { arrows: { to: { enabled: true, scaleFactor: .6 } }, smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: .4 } },
      nodes: { borderWidth: 1.5, shapeProperties: { borderRadius: 8 } },
    });
    return () => { networkRef.current?.destroy(); networkRef.current = null; };
  }, [data, rg, hideGeneral, showOff]);

  useEffect(() => {
    if (!focus || !networkRef.current) return;
    networkRef.current.selectNodes([Number(focus)]);
    networkRef.current.focus(Number(focus), { scale: 1.2, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
  }, [focus]);

  // highlight one route: its persons and links
  useEffect(() => {
    const net = networkRef.current;
    if (!net || !rg) return;
    const r = rg.routes.find(x => x.label === route);
    if (!r) { net.unselectAll(); return; }
    net.setSelection({ nodes: r.ids, edges: r.ids.slice(1).map((id, i) => `${r.ids[i]}>${id}`) }, { highlightEdges: false });
  }, [route, rg]);

  const fit = () => networkRef.current?.fit({ animation: { duration: 400 } });

  const disableRoute = async key => {
    setBusy(true);
    try {
      await api.put(`/graph/disabled-routes/${encodeURIComponent(matnPaths.scope)}`, { keys: [key], disabled: true });
      toast('عُطّل الطريق — يُعاد تفعيله من صفحة أسانيد المتون');
      setRoute(null);
      await reloadPaths();
    } catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };

  const changeMatn = v => { setMatnId(v); setFocus(''); setRoute(null); };
  const linkCount = rg ? rg.edges.filter(e => !e.off).length : data ? data.matnEdges.length + data.quranEdges.length : 0;

  return (
    <>
      <div className="toolbar">
        <Segmented value={mod} onChange={v => { setMod(v); setFocus(''); }} options={[
          { value: 'both', label: 'الكل' }, { value: 'mutoon', label: 'المتون' }, { value: 'quran', label: 'القرآن' },
        ]} />
        {mod !== 'quran' && (
          <div style={{ minWidth: 200, flex: '0 1 260px' }}>
            <Combobox value={matnId} opts={mutoon.map(m => ({ value: m.id, label: m.title }))} onChange={changeMatn} placeholder="أسانيد متن واحد…" />
          </div>
        )}
        <div style={{ minWidth: 200, flex: '0 1 260px' }}>
          <Combobox value={focus} opts={nodeOpts} onChange={setFocus} placeholder="انتقل إلى علَم…" />
        </div>
        {byMatn ? (
          matnPaths.disabled.length > 0 && (
            <label className="row small muted" style={{ gap: 6 }}>
              <input type="checkbox" checked={showOff} onChange={e => setShowOff(e.target.checked)} /> إظهار المعطّلة ({matnPaths.disabled.length})
            </label>
          )
        ) : mod !== 'quran' && (
          <label className="row small muted" style={{ gap: 6 }}>
            <input type="checkbox" checked={hideGeneral} onChange={e => setHideGeneral(e.target.checked)} /> إخفاء الاتصالات بلا متن محدد
          </label>
        )}
        <div className="spacer" />
        {(loading || pathsLoading) && <span className="spinner muted" />}
        {data && <span className="small muted">{linkCount} اتصالاً</span>}
        <button className="btn btn-secondary btn-sm" onClick={fit}><Icon name="network" size={15} /> عرض الكل</button>
      </div>

      {rg && (
        <div className="route-chips" style={{ padding: '0 0 12px' }}>
          {rg.routes.length === 0 && <span className="small muted">لا يوجد سند متصل لهذا المتن</span>}
          {rg.routes.map(r => (
            <span key={r.key} className={`route-chip${route === r.label ? ' active' : ''}`}>
              <button className="link-btn" onClick={() => setRoute(x => (x === r.label ? null : r.label))} title="إبراز الطريق">
                <b>ط{r.label}</b> <span>{r.n} رواة</span>
              </button>
              {r.general && <span className="badge badge-outline" title="اتصال شيخك بك عام — لكل المتون">عام</span>}
              <button className="icon-btn" disabled={busy} title="تعطيل هذا الطريق" aria-label={`تعطيل الطريق ${r.label}`}
                onClick={() => disableRoute(r.key)}><Icon name="x" size={13} /></button>
            </span>
          ))}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div ref={containerRef} className="graph-canvas" />
        <div className="legend">
          {!rg && <span><i className="dot" style={{ background: 'var(--primary)' }} />علماء المتون</span>}
          {!rg && <span><i className="dot" style={{ background: 'var(--accent)' }} />القرّاء</span>}
          <span><i style={{ background: 'var(--primary)' }} />سماع / قراءة</span>
          <span><i style={{ background: 'var(--purple)' }} />إجازة</span>
          <span><i style={{ background: 'var(--info)' }} />عرض</span>
          {!rg && <span><i style={{ background: 'repeating-linear-gradient(90deg, var(--accent) 0 4px, transparent 4px 7px)' }} />بلا متن محدد</span>}
          <span><b>3 ·</b> الترتيب من شيخي</span>
          {rg && <span><b>1.2</b> رقم الطريق (الشيخ.الطريق) كما في صفحة الأسانيد</span>}
        </div>
      </div>
    </>
  );
}
