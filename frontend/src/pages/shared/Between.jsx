import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import Combobox from '../../components/ui/Combobox';
import Segmented from '../../components/ui/Segmented';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import IsnadGroups from '../../components/isnad/IsnadGroups';
import IsnadText from '../../components/isnad/IsnadText';
import { personOptions } from '../../utils/options';
import { countLabel } from '../../utils/text';
import { betweenChoice, betweenQuery, quranChoices } from '../../utils/between';

const PATH_FORMS = ['سند واحد', 'سندان', 'أسانيد', 'سنداً'];

/**
 * «إسناد علَم»: the routes of any person (me by default) to another person, a matn's author or a
 * Quran choice, with the isnad text of all of them together. Read only (routes are switched off on
 * the isnad pages).
 */
export default function Between() {
  const { notifyError } = useUI();
  const [params, setParams] = useSearchParams();
  const c = betweenChoice(params);
  const set = patch => setParams(prev => {
    const next = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    return next;
  }, { replace: true });

  const { data: lists } = useLoad(async () => {
    const [p, m, r, q] = await Promise.all([api.get('/persons'), api.get('/mutoon'), api.get('/quran/riwayat'), api.get('/quran/qiraat')]);
    return { persons: p.data, mutoon: m.data, riwayat: r.data, qiraat: q.data };
  }, [], { persons: [], mutoon: [], riwayat: [], qiraat: [] });
  const fromOpts = useMemo(() => personOptions(lists.persons.filter(p => Number(p.id) > 0), { includeMe: true }), [lists.persons]);
  const toOpts = useMemo(() => personOptions(lists.persons.filter(p => String(p.id) !== c.from)), [lists.persons, c.from]);
  const matnOpts = useMemo(() => lists.mutoon.map(m => ({ value: m.id, label: m.title, sub: m.author_name || undefined })), [lists.mutoon]);
  const qOpts = useMemo(() => quranChoices(lists.riwayat, lists.qiraat), [lists.riwayat, lists.qiraat]);

  const query = betweenQuery(c);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!query) { setResult(null); return; }
    let alive = true;
    setLoading(true);
    api.get(`/graph/between?${query}`)
      .then(r => alive && setResult(r.data))
      .catch(e => { if (alive) { notifyError(e); setResult(null); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const paths = result?.paths || [];
  // every route together, as the ijaza writes them
  const allChains = useMemo(() => paths.flatMap(g => (g.chains.length ? g.chains.map(ch => [g.firstEdge, ...ch]) : [[g.firstEdge]])), [paths]);
  const targetLabel = result && (result.target.kind === 'matn' ? `${result.target.author_name || '—'} (${result.target.name})` : result.target.name);

  return (
    <div className="stack">
      <section className="card card-pad between-form">
        <div className="field">
          <span className="field-label">من</span>
          <Combobox value={c.from} opts={fromOpts} allowClear={false} onChange={v => set({ from: v ?? 0 })} placeholder="ابحث عن العلَم…" />
        </div>
        <div className="field">
          <span className="field-label">إلى</span>
          <Segmented value={c.kind} onChange={v => set({ kind: v })} options={[
            { value: 'person', label: 'علَم' }, { value: 'matn', label: 'مؤلف متن' }, { value: 'quran', label: 'القرآن' },
          ]} />
        </div>
        {c.kind === 'person' && (
          <>
            <div className="field">
              <Combobox value={c.to} opts={toOpts} onChange={v => set({ to: v ?? '' })} placeholder="ابحث عن العلَم…" />
            </div>
            <div className="field">
              <span className="field-label">بالاتصالات</span>
              <Segmented value={c.module} onChange={v => set({ module: v === 'quran' ? 'quran' : '' })} options={[
                { value: 'mutoon', label: 'المتون' }, { value: 'quran', label: 'القرآن' },
              ]} />
            </div>
          </>
        )}
        {c.kind === 'matn' && (
          <div className="field">
            <Combobox value={c.matn} opts={matnOpts} onChange={v => set({ matn: v ?? '' })} placeholder="ابحث عن المتن…" />
            <span className="field-hint">إلى مؤلفه، باتصالات هذا المتن والاتصالات العامة</span>
          </div>
        )}
        {c.kind === 'quran' && (
          <div className="field">
            <Combobox value={c.q} opts={qOpts} onChange={v => set({ q: v ?? '' })} placeholder="ابحث عن الرواية أو القراءة…" />
            <span className="field-hint">إلى النبي ﷺ</span>
          </div>
        )}
      </section>

      {!query && <div className="card"><EmptyState icon="chain" title="اختر من أين وإلى أين" subtitle="تظهر هنا الطرق الموصلة ونص إسنادها" /></div>}

      {query && loading && <div className="stack"><div className="skeleton" style={{ height: 90 }} /><div className="skeleton" style={{ height: 200 }} /></div>}

      {query && !loading && result && (
        <>
          <div className="hero">
            <div className="row row-wrap">
              <div className="spacer">
                <div className="hero-title">{result.from.name} ← {targetLabel}</div>
                <div className="hero-sub">
                  {result.target.kind === 'person' ? (result.target.module === 'quran' ? 'باتصالات القرآن' : 'باتصالات المتون') : result.target.kind === 'matn' ? 'باتصالات المتن والاتصالات العامة' : 'إلى النبي ﷺ'}
                </div>
              </div>
              <span className="badge">{countLabel(paths.length, PATH_FORMS)}</span>
            </div>
          </div>

          {paths.length === 0 ? (
            <div className="card"><EmptyState icon="alert" title="لا طريق متصل"
              subtitle={`لا تصل اتصالاتك من «${result.from.name}» إلى «${targetLabel}»`}
              action={<Link to={result.target.kind === 'quran' || result.target.module === 'quran' ? '/quran/connections' : '/mutoon/connections'} className="btn btn-secondary">إدارة الاتصالات</Link>} /></div>
          ) : (
            <>
              <section className="card">
                <div className="card-head"><Icon name="text" /><div className="card-title">نص الإسناد</div><span className="muted">الطرق كلها معاً</span></div>
                <div className="card-pad"><IsnadText chains={allChains} authorId={result.target.kind === 'matn' ? result.end_id : null} /></div>
              </section>
              <IsnadGroups paths={paths} endIds={[result.end_id]} readOnly
                via={Number(result.from.id) === 0 ? 'من طريق شيخي' : 'من طريق'} />
            </>
          )}
        </>
      )}
    </div>
  );
}
