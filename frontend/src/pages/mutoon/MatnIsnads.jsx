import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import useLoad from '../../hooks/useLoad';
import { useUI } from '../../components/ui/UIProvider';
import IsnadGroups from '../../components/isnad/IsnadGroups';
import ShareButton from '../../components/isnad/ShareButton';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Icon from '../../components/ui/Icon';
import { matches, countLabel } from '../../utils/text';

const PATH_FORMS = ['سند واحد', 'سندان', 'أسانيد', 'سنداً'];

export default function MatnIsnads() {
  const { notifyError } = useUI();
  const [params, setParams] = useSearchParams();
  const selected = params.get('matn');
  const { data: mutoon, loading: listLoading } = useLoad(() => api.get('/mutoon?connected=1').then(r => r.data), [], []);

  const [search, setSearch]   = useState('');
  const [subject, setSubject] = useState('');
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

  // quiet: reload in place (after a route is switched off/on) without the skeleton
  const load = async (id, { quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try { const { data } = await api.get(`/graph/matn/${id}/paths`); setResult(data); }
    catch (e) { notifyError(e); if (!quiet) setResult(null); }
    finally { if (!quiet) setLoading(false); }
  };

  // the URL (?matn=id) is the source of truth: deep links, refresh and back button all work
  useEffect(() => { if (selected) load(selected); }, [selected]);

  const subjects = useMemo(() => [...new Set(mutoon.map(m => m.subject).filter(Boolean))].sort(), [mutoon]);
  const filtered = mutoon.filter(m => (!subject || m.subject === subject) && matches(search, m.title, m.author_name));

  const matn = result?.matn;
  const paths = result?.paths || [];

  return (
    <div className="split">
      <aside className="card split-side">
        <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }} className="stack">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في المتون…" />
          {subjects.length > 1 && (
            <div className="chips">
              <button className={`chip${!subject ? ' active' : ''}`} onClick={() => setSubject('')}>الكل</button>
              {subjects.map(s => <button key={s} className={`chip${subject === s ? ' active' : ''}`} onClick={() => setSubject(s)}>{s}</button>)}
            </div>
          )}
        </div>
        <div className="side-list">
          {listLoading && !mutoon.length && [1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 44, margin: 6 }} />)}
          {!listLoading && filtered.length === 0 && (
            <div className="small muted" style={{ padding: 16, textAlign: 'center' }}>
              {mutoon.length ? 'لا نتائج' : <>لا توجد متون متصلة بعد. <Link to="/mutoon/connections">أضف اتصالاً</Link></>}
            </div>
          )}
          {filtered.map(m => (
            <button key={m.id} className={`side-item${String(m.id) === selected ? ' active' : ''}`} onClick={() => setParams({ matn: m.id })}>
              <span className="t">{m.title}</span>
              <span className="s">{[m.author_name, m.subject].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      </aside>

      <section>
        {!selected && (
          <div className="card"><EmptyState icon="chain" title="اختر متناً" subtitle="ستظهر هنا جميع أسانيدك المتصلة إلى مؤلفه" /></div>
        )}

        {selected && loading && (
          <div className="stack">
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 220 }} />
          </div>
        )}

        {selected && !loading && matn && (
          <>
            <div className="hero">
              <div className="row row-wrap">
                <div className="spacer">
                  <div className="hero-title">{matn.title}</div>
                  <div className="hero-sub">{[matn.author_name && `للإمام ${matn.author_name}`, matn.subject].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="badge">{countLabel(paths.length, PATH_FORMS)}</span>
                <ShareButton url={`/share/matn/${matn.id}`} disabled={!paths.length} />
              </div>
            </div>

            {!matn.author_id && (
              <div className="munqati" style={{ marginBottom: 14 }}>
                <Icon name="alert" size={16} /> لم يُحدَّد مؤلف لهذا المتن، فلا يمكن بناء السند. <Link to="/mutoon/list">حدّد المؤلف</Link>
              </div>
            )}

            {matn.author_id && paths.length === 0 && !result.disabled?.length && (
              <div className="card"><EmptyState icon="alert" title="لا يوجد سند متصل"
                subtitle="السلسلة لا تصل إلى المؤلف بعد — أكمل الحلقات الناقصة"
                action={<Link to="/mutoon/connections" className="btn btn-secondary">إدارة الاتصالات</Link>} /></div>
            )}

            <IsnadGroups key={result.scope} paths={paths} disabled={result.disabled} scope={result.scope} endIds={[matn.author_id]}
              via="من طريق شيخي" onChanged={() => load(selected, { quiet: true })} />
          </>
        )}
      </section>
    </div>
  );
}
