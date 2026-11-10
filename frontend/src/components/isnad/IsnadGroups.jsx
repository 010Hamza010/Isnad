import React, { useMemo, useState } from 'react';
import api from '../../utils/api';
import { useUI } from '../ui/UIProvider';
import Segmented from '../ui/Segmented';
import Icon from '../ui/Icon';
import ChainView from './ChainView';
import IsnadText from './IsnadText';
import { numberRoutes, isGeneralRoute } from '../../utils/chains';

const ORDER_KEY = 'isnad.routeOrder';
const readOrder = () => { try { return localStorage.getItem(ORDER_KEY) || 'high'; } catch { return 'high'; } };
const saveOrder = v => { try { localStorage.setItem(ORDER_KEY, v); } catch { /* private mode */ } };

/**
 * The isnad groups of one matn / Quran option: numbered routes (ordered highest first or as
 * entered), each can be switched off — saved per `scope`, and left out of the text and ijazat.
 * `onChanged` reloads the paths after a route is switched off or on.
 */
export default function IsnadGroups({ paths, disabled = [], scope, endIds, scopeOf, via, onChanged }) {
  const { toast, notifyError, confirm } = useUI();
  const [order, setOrder] = useState(readOrder);
  const [asText, setAsText] = useState({});
  const [hl, setHl] = useState(null);       // { group, route } highlighted from the route chips
  const [busy, setBusy] = useState(false);
  const [showOff, setShowOff] = useState(false);

  const groups = useMemo(() => paths.map(g => {
    const routes = numberRoutes(g, order);
    // the group as the text renderer and the tree see it: chains in the displayed order
    return { g: { ...g, chains: routes.map(r => r.chain), keys: routes.map(r => r.key) }, routes };
  }), [paths, order]);
  const highest = Math.min(...groups.flatMap(x => x.routes.map(r => r.n)));
  const generalKeys = groups.flatMap(({ g, routes }) => routes.filter(r => isGeneralRoute(g.firstEdge, r.chain)).map(r => r.key));

  const toggle = async (keys, off) => {
    setBusy(true);
    try {
      await api.put(`/graph/disabled-routes/${encodeURIComponent(scope)}`, { keys, disabled: off });
      toast(off ? (keys.length > 1 ? `عُطّلت ${keys.length} طرق` : 'عُطّل الطريق') : 'أُعيد تفعيل الطريق');
      setHl(null);
      await onChanged();
    } catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };

  const disableGeneral = async () => {
    const ok = await confirm({ title: 'تعطيل الطرق العامة', message: `ستُعطَّل ${generalKeys.length} طرق تمرّ باتصال «عام — لكل المتون». يمكنك إعادة تفعيل أيّ منها لاحقاً.`, confirmLabel: 'تعطيل' });
    if (ok) toggle(generalKeys, true);
  };

  const changeOrder = v => { setOrder(v); saveOrder(v); setAsText({}); };

  return (
    <>
      {(paths.length > 0 || disabled.length > 0) && (
        <div className="row row-wrap" style={{ marginBottom: 12, gap: 8 }}>
          <Segmented value={order} onChange={changeOrder} options={[
            { value: 'high', label: 'الأعلى أولاً' }, { value: 'entry', label: 'ترتيب الإدخال' },
          ]} />
          <div className="spacer" />
          {generalKeys.length > 0 && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={disableGeneral}>
              <Icon name="filter" size={14} /> تعطيل الطرق العامة ({generalKeys.length})
            </button>
          )}
        </div>
      )}

      {groups.map(({ g, routes }, i) => (
        <div key={g.firstEdge.to_person_id} className="card chain-card">
          <div className="card-head">
            <span className="badge badge-primary">{i + 1}</span>
            <span className="via">{via}</span>
            <span className="strong">{g.firstEdge.to_name}</span>
            {routes.length > 1 && <span className="badge">{routes.length} طرق</span>}
            <button className={`btn btn-sm ${asText[i] ? 'btn-secondary' : 'btn-ghost'}`} style={{ marginInlineStart: 'auto' }}
              onClick={() => setAsText(s => ({ ...s, [i]: !s[i] }))} aria-pressed={!!asText[i]}>
              <Icon name="text" size={14} /> نص الإسناد
            </button>
          </div>

          <div className="route-chips">
            {routes.map((r, j) => (
              <span key={r.key} className={`route-chip${hl?.group === i && hl.route === j + 1 ? ' active' : ''}`}
                onMouseEnter={() => setHl({ group: i, route: j + 1 })} onMouseLeave={() => setHl(null)}>
                <b>ط{j + 1}</b>
                <span>{r.n} {r.n > 10 ? 'راوياً' : r.n > 2 ? 'رواة' : r.n === 2 ? 'راويان' : 'راوٍ'}</span>
                {r.n === highest && <span className="badge badge-accent" title="أقل عدد من الرواة">الأعلى</span>}
                {isGeneralRoute(g.firstEdge, r.chain) && <span className="badge badge-outline">عام</span>}
                <button className="icon-btn" disabled={busy} title="تعطيل هذا الطريق" aria-label={`تعطيل الطريق ${j + 1}`}
                  onClick={() => toggle([r.key], true)}><Icon name="x" size={13} /></button>
              </span>
            ))}
          </div>

          {asText[i] && <IsnadText group={g} />}
          <ChainView firstEdge={g.firstEdge} chains={g.chains} routes={routes.map((_, j) => j + 1)} endIds={endIds} scopeOf={scopeOf}
            highlight={hl?.group === i ? hl.route : null} />
        </div>
      ))}

      {disabled.length > 0 && (
        <div className="card">
          <div className="card-head">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowOff(s => !s)} aria-expanded={showOff}>
              <Icon name={showOff ? 'chevDown' : 'chevron'} size={14} /> طرق معطّلة ({disabled.length})
            </button>
            <span className="small muted">لا تظهر في نص الإسناد ولا في الإجازات الجديدة</span>
            {showOff && disabled.length > 1 && (
              <button className="btn btn-secondary btn-sm" style={{ marginInlineStart: 'auto' }} disabled={busy}
                onClick={() => toggle(disabled.map(d => d.key), false)}>تفعيل الكل</button>
            )}
          </div>
          {showOff && (
            <div className="off-routes">
              {disabled.map(d => (
                <div key={d.key} className="off-route">
                  <span className="spacer">{d.names.join(' ← ')}</span>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggle([d.key], false)}>
                    <Icon name="eye" size={14} /> تفعيل
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
